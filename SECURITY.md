# Security Architecture

This document describes the security measures implemented in the Shopping-Agent project.

## Encryption

All sensitive credentials are encrypted at rest using **AES-256-GCM**.

- **Algorithm**: `aes-256-gcm` with 12-byte IV and 16-byte authentication tag
- **Scope**: LLM API keys and Shopify access tokens
- **Storage format**: `enc:` prefix + base64-encoded `IV || AuthTag || Ciphertext`
- **Key management**: 32-byte key derived from the `ENCRYPTION_KEY` environment variable (64 hex characters)
- **Legacy support**: Unencrypted values are supported for reads (no `enc:` prefix), but all new writes require encryption

Reference: `artifacts/api-server/src/services/encryption.ts`

## Authentication

### Merchant Authentication (Shopify OAuth)

Merchants authenticate via the standard Shopify Admin OAuth flow:

- **HMAC verification**: All OAuth callback parameters are verified using `crypto.timingSafeEqual` with the Shopify API secret
- **Token format**: `mtkn_` prefix + 32 cryptographically random bytes (hex-encoded)
- **Session TTL**: 72 hours
- **Cookie settings**: `httpOnly: true`, `secure: true`, `sameSite: "lax"`
- **State management**: OAuth state tokens stored in `pending_oauth_states` database table with 10-minute TTL and a 10,000 pending state cap
- **Token binding**: Merchant tokens are bound to a specific `store_domain` and verified on every request

Reference: `artifacts/api-server/src/routes/auth.ts`, `artifacts/api-server/src/services/merchant-auth.ts`

### Shopper Sessions

Anonymous shopper sessions for the consumer-facing chat:

- **Session ID**: UUID-based, passed via query parameter, request body, or `x-session-id` header
- **Database validation**: Every session is validated against the database with `store_domain` binding
- **Caching**: LRU cache (5,000 entries, 30s TTL) to reduce database lookups; cache is invalidated on session expiry or store deletion
- **Middleware**: `validateSession` middleware attaches `req.validatedSessionId` on success

Reference: `artifacts/api-server/src/services/session-validator.ts`

### MCP Customer Accounts OAuth

PKCE-based OAuth 2.0 flow for connecting shoppers to their Shopify customer accounts:

- **Discovery**: Endpoints resolved via `https://{storeDomain}/.well-known/customer-account-api`
- **PKCE**: Full code challenge/verifier flow for public client security
- **Scope**: `customer-account-mcp-api:full`
- **Token storage**: Access and refresh tokens encrypted with AES-256-GCM and stored in the `mcp_connections` database table
- **Auto-refresh**: Expired tokens are automatically refreshed using stored refresh tokens
- **Client ID**: Resolved per-store (`customer_account_client_id` column) or via global `SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID` env var
- **Fallback**: When not connected, requests fall back to the public Storefront MCP

Reference: `artifacts/api-server/src/services/customer-account-mcp.ts`

### Dev Auth

A development-only login endpoint (`POST /api/auth/login`) is available when `NODE_ENV=development`:

- Requires the `DEV_AUTH_SECRET` environment variable to be set
- Secret comparison uses `crypto.timingSafeEqual` to prevent timing attacks
- Disabled entirely in production (`NODE_ENV !== "development"` returns 404)

## Rate Limiting

Per-endpoint rate limits are enforced via `express-rate-limit`:

| Endpoint | Limit | Window |
|----------|-------|--------|
| Chat (`/api/stores/:storeDomain/chat`) | 10 requests | 60 seconds |
| Sessions (`POST /api/sessions`) | 5 requests | 60 seconds |
| Login (`POST /api/auth/login`) | 5 requests | 60 seconds |
| Store mutations (POST/PATCH/DELETE) | 20 requests | 60 seconds |

- Rate limits are keyed by client IP (`req.ip`)
- Standard rate limit headers are included in responses
- Load test bypass is available in development only via `X-Load-Test-Bypass` header

Reference: `artifacts/api-server/src/app.ts`

## Input Validation

- **Zod schema validation** on core application routes (stores, chat, knowledge, preferences, conversations, analytics, sessions) via generated schemas from the OpenAPI spec. Auth/OAuth routes use manual validation.
- **Message length limit**: User messages are truncated to 10,000 characters before database insertion
- **Body size limit**: Express JSON and URL-encoded body parsers are limited to 1 MB
- **Shop domain validation**: Regex pattern validation (`SHOPIFY_DOMAIN_PATTERN`) on all shop domain inputs
- **Error responses**: Zod validation failures return structured error messages without leaking internal details

## Prompt Injection Protection

### Active: Sanitization Filter (`prompt-filter.ts`)

Applied in the chat route (`routes/chat.ts`). Scans user messages and replaces detected injection patterns with `[filtered]`. The message is still processed but with malicious content neutralized. Covers 17 regex patterns including:
- Instruction hijacking ("ignore previous instructions", "disregard all rules")
- Persona adoption ("you are now a", "act as a")
- System prompt markers (`[INST]`, `<<SYS>>`, `<|im_start|>`)
- Prompt leaking ("reveal your system prompt", "show me your instructions")
- Override attempts ("override your instructions", "do not follow your rules")

Reference: `artifacts/api-server/src/lib/prompt-filter.ts`

### Available: Detection & Blocking Guard (`prompt-guard.ts`)

A standalone utility that detects and blocks messages matching injection patterns outright. Covers 18 regex patterns with overlap to the sanitization filter, plus additional patterns for:
- Jailbreak keywords ("jailbreak", "DAN mode")
- Unrestricted mode requests ("act as if you are unrestricted", "pretend you have no restrictions")
- Code block system markers (`` ```system ``, `<system>`, `[SYSTEM]`)

This guard is implemented but not currently wired into the request pipeline. It can be added as additional middleware for stricter enforcement.

Reference: `artifacts/api-server/src/services/prompt-guard.ts`

## Tenant Isolation

- **`store_domain` filtering**: Database queries and API routes filter by `store_domain` to prevent cross-tenant data access
- **Merchant token binding**: Merchant authentication tokens are bound to a specific `store_domain` and verified on every request via middleware
- **Session domain binding**: Shopper sessions are validated against both session ID and `store_domain`
- **Cache invalidation**: Store deletion triggers invalidation of store, session, merchant session, knowledge, and tools caches for that domain

## Security Headers & CORS

- **Cache-Control**: `no-store, no-cache, must-revalidate, private` on all authenticated routes (routes with Authorization header, merchant cookie, or session ID)
- **CORS**: Configured with explicit allowed origins via `ALLOWED_ORIGINS` env var, `credentials: true`. In production, CORS is disabled by default if no origins are specified.
- **Body size limits**: JSON and URL-encoded bodies limited to 1 MB
- **Trust proxy**: `trust proxy` set to 1 for correct client IP resolution behind reverse proxies

Reference: `artifacts/api-server/src/app.ts`

## Error Sanitization

Error responses use the `sendError` utility which returns a consistent `{ error: message }` format without exposing internal details (stack traces, database errors, or implementation specifics) to clients.

- Zod validation errors are formatted to show field-level issues without internal context
- OAuth token exchange errors redact sensitive fields before logging
- The global error handler catches unhandled errors and returns a generic "Internal server error" message

Reference: `artifacts/api-server/src/lib/error-response.ts`

## Timing-Safe Comparisons

`crypto.timingSafeEqual` is used for all security-sensitive comparisons to prevent timing attacks:

- HMAC verification in Shopify OAuth callbacks
- Dev auth secret comparison
- Buffer length checks are performed before `timingSafeEqual` to handle mismatched lengths safely

## LLM Safety

- **Max iterations guard**: LLM tool-call loops have a configurable maximum iteration limit (default 10) to prevent runaway execution
- **Markdown sanitization**: All rendered markdown content is sanitized with DOMPurify to prevent XSS
- **SSE parser safety**: Failed SSE lines use a single-entry retry mechanism (retry once, then discard) to prevent accumulation

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly by opening a private issue or contacting the maintainers directly. Do not disclose security issues publicly until a fix is available.
