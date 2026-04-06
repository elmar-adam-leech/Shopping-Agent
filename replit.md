# Shopify MCP AI Shopping Agent

## Overview
This project is a multi-tenant Shopify AI Shopping Agent designed to enhance e-commerce customer interactions. It allows merchants to configure an AI assistant with their store's knowledge, enabling customers to chat for product search, cart management, and checkout. The agent integrates with Shopify's Storefront MCP and supports various LLM providers. Its core purpose is to provide an intelligent, automated shopping assistant that streamlines the customer journey, drives sales, and leverages advanced AI capabilities within the Shopify ecosystem to increase customer satisfaction. Merchants can conduct A/B prompt testing with configurable variants and analytics to determine optimal AI responses.

## User Preferences
- I prefer simple language.
- I like functional programming.
- I want iterative development.
- Ask before making major changes.
- I prefer detailed explanations.
- Do not make changes to the folder `lib/api-spec`.
- Do not make changes to the file `lib/api-spec/openapi.yaml`.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, Vite, Tailwind CSS, and shadcn/ui, providing a modern and responsive user interface. The design prioritizes clarity and ease of use, with components like chat interfaces, settings panels, and analytics dashboards. Embed modes are designed for seamless integration into existing Shopify themes.
Key UI components include:
- **Rich Multi-Modal Chat Rendering**: Features product carousels, quick add-to-cart buttons, comparison tables, inline cart summaries, product image galleries, and interactive collection cards.
- **Shared UI Components & Utilities**: Includes `ToolBadge`, `LoadingOverlay`, `EntityCard`, `AgentAvatar`, and `Error Utilities` for consistent design and functionality.

**Dark Mode**: Full dark mode support via a ThemeProvider context (`src/components/theme/theme-provider.tsx`). Users can switch between Light, Dark, and System modes via a segmented toggle in the sidebar and home page. Theme preference persists in localStorage (`shopify-agent-theme`). An inline script in `index.html` prevents flash of unstyled content on load. The `.dark` class on `<html>` activates CSS custom properties defined in `index.css`. Embed pages are unaffected (they inherit the storefront's own theme).

**Mobile UX**: All interactive elements meet 44px minimum touch targets. The merchant dashboard has a bottom navigation bar on mobile viewports (below `md` breakpoint) with Home, Chat, Settings, Analytics, and Cart items. Content spacing accounts for bottom nav height plus safe-area insets via `--bottom-nav-height` CSS variable. Responsive padding and text sizing are applied across all pages for 375px-wide screens.

### Technical Implementations
- **Monorepo**: Managed with pnpm workspaces for multiple packages (API server, frontend, shared libraries).
- **Backend**: Express 5 serves as the API server.
- **Database**: PostgreSQL with Drizzle ORM for data persistence.
- **LLM Integration**: Supports multiple providers (OpenAI, Anthropic, xAI, Google Gemini) with a unified interface and encrypted API keys (AES-256-GCM, requires `ENCRYPTION_KEY` env var — 64 hex chars / 32 bytes). Keys are encrypted on store create/update and decrypted before LLM calls. Plaintext legacy keys are supported for reads but new writes require encryption to be configured.
- **API Communication**: Type-safe client-server interaction via Orval for OpenAPI codegen.
- **Multi-Tenancy**: Secured by `store_domain` scoping, PostgreSQL Row-Level Security (RLS) with FORCE ROW LEVEL SECURITY, and cross-tenant guard middleware. Every backend route and DB query is scoped by `store_domain` for secure multi-tenant operation. RLS policies are enabled on all tenant-scoped tables (`stores`, `knowledge`, `conversations`, `sessions`, `preferences`, `analytics`, `mcp_connections`, `user_consents`). Default behavior is fail-closed (no rows visible without tenant context). All tenant-scoped queries use `withTenantScope(storeDomain, fn)` which sets `app.current_store_domain` via `SET LOCAL` inside a transaction. Administrative/maintenance operations use `withAdminBypass(fn)` which sets `app.rls_bypass='on'` inside a transaction. Cross-tenant guard middleware detects and blocks session/conversation ownership violations.
- **Audit Logging**: Dedicated `audit_logs` table records all security-sensitive mutations (store CRUD, merchant auth, token changes, knowledge mutations, MCP operations, tool executions, cross-tenant access attempts) with actor, action, resource type/id, metadata, IP address, and timestamp. Helpers like `logAuditFromRequest()` extract context from Express requests and `logCrossTenantAttempt()` provide consistent attribution for security events.
- **Soft Delete Infrastructure**: All user-initiated deletions of stores, conversations, and knowledge entries use soft delete (setting `deleted_at` timestamp) instead of hard delete. All SELECT queries filter out soft-deleted records via `isNull(table.deletedAt)`. Soft-deleting a store cascades to its conversations and knowledge entries. DB maintenance purges soft-deleted records older than 30 days (configurable via `SOFT_DELETE_RETENTION_DAYS` env var). REST endpoints: `GET /stores/:storeDomain/knowledge/deleted`, `PATCH /stores/:storeDomain/knowledge/:id/restore`, `GET /stores/:storeDomain/conversations/deleted`, `PATCH /stores/:storeDomain/conversations/:id/restore`. Dashboard UI shows "Recently Deleted" sections with restore buttons. All soft-delete and restore actions are audit logged.
- **Graceful Shutdown**: The API server handles SIGTERM/SIGINT signals with a graceful shutdown sequence: stops accepting new connections, drains in-flight SSE streams (sends restart notification), stops DB maintenance, and closes the DB pool. Configurable timeout via `SHUTDOWN_TIMEOUT_MS` (default 10s). New chat requests during shutdown receive 503. DB maintenance tracks state in `maintenance_state` table with deduplication and stale lock recovery.
- **Session Management**: Customer and merchant sessions are persisted in the database with defined TTLs. OAuth pending states are stored in the DB (`pending_oauth_states` table) for horizontal scaling support.
- **Shop Knowledge**: Merchants can input structured knowledge that is dynamically injected into the LLM's system prompt for contextual responses. Bulk import supports markdown splitting by headings, pasting markdown content, or uploading .md/.txt files.
- **Brand Voice & Customization**: Merchants define brand voice (tone: friendly/professional/playful/luxury, personality, greeting/sign-off styles), custom instructions, welcome messages, and product recommendation strategies (personalized, bestsellers-first, new-arrivals-first, price-low-to-high). Settings are stored in the stores table (`brand_voice`, `custom_instructions`, `welcome_message`, `recommendation_strategy`).
- **UCP Dynamic Capability Negotiation**: Full UCP 2026-01-11 specification support for dynamic capability discovery and tool generation. At session start, the agent fetches `/.well-known/ucp`, parses all service types and nested capabilities (checkout, orders, subscriptions, loyalty, discounts, preorders, wishlists, gifting), and dynamically generates tool definitions. Discovered capabilities are persisted per store in `ucp_capabilities` with configurable refresh intervals (default 1 hour). System prompt includes negotiated capabilities with sanitization to prevent injection. Non-UCP stores gracefully fall back to Storefront MCP/GraphQL. Negotiation outcomes are logged to analytics for debugging.
- **Theme Embeds**: Various embed modes (Chat, AI Search, Contextual Assistant, Product Assistant) for native integration into Shopify themes via script tags or iframes.
- **Chat Widget**: A Shopify theme app extension provides a customizable chat widget with merchant-controlled enable/disable toggles.
- **"Shop For Me" Page**: A public-facing full-page chat interface at `/shop/{storeDomain}`.
- **Performance & Caching**: LRU caches with hit/miss monitoring for frequently accessed data (stores, sessions, knowledge, MCP tools, UCP discovery). Conversation messages use atomic JSONB append with a 200-message cap and automatic truncation. MCP tools/list and UCP discovery run in parallel with a circuit breaker (5 failures → 5min cooldown). Analytics queries backed by composite indexes on (store_domain, created_at, event_type), partial index on non-null queries, and session_id index.
- **Middleware Organization**: Centralized middleware in `artifacts/api-server/src/middleware/` with a barrel `index.ts` re-export. Includes tenant validation, session validation, merchant auth, rate limiters, cache-control, request logging, and gzip compression. Route files import from `../middleware` instead of `../services` directly.
- **Request Logging**: Structured request logger logs method, path, status code, and response time with `[request]` prefix. Health check endpoints are skipped to reduce noise.
- **Compression**: Gzip compression via the `compression` package, applied globally but skipped for `text/event-stream` (SSE) responses to avoid buffering delays.
- **Rate Limiting**: Implemented on chat endpoints to prevent abuse.
- **Security**: HMAC verification, strict body size limits, CORS configuration, global error handling, and LLM tool-call loop guard (default 10 iterations). Markdown rendering is sanitized with DOMPurify to prevent XSS. Dev auth endpoint requires `DEV_AUTH_SECRET` env var. Session IDs in conversation routes use middleware-validated values. User messages are truncated to 10,000 chars before DB insertion. SSE parser failedLines set is bounded to 50 entries. Cross-tenant access detection middleware (`cross-tenant-guard.ts`) validates session and conversation ownership at both middleware and DB level, logging violations to the audit trail.
- **Access Token Scope Validation**: OAuth callback validates that Shopify access token scopes match the minimum required set. Insufficient scopes are rejected with a 403 and logged to the audit trail.
- **Prompt Injection Guard**: Layered defense system in `artifacts/api-server/src/services/prompt-guard.ts`:
  - **Layer 1 (Regex)**: Fast deterministic pattern matching against ~25 known patterns.
  - **Layer 2 (LLM Classifier)**: Intent-based classification using Replit AI integrations proxy with configurable confidence thresholds.
  - **Layer 3 (System Prompt Hardening)**: Explicit refusal instructions appended to every system prompt.
  - **Tool Response Scanning**: MCP/UCP tool results are scanned for indirect injection.
  - **Async Output Auditing**: Assistant output is audited for hallucinations and data leakage, with retraction support.
  - **Merchant Controls**: Sensitivity settings and blocked topics available in the stores table.
- **Privacy & Data Management**: Full consent management system with GDPR/CCPA compliance, per-session consent tracking, data export/deletion, and configurable data retention periods via store settings.
- **Customer Account MCP**: OAuth 2.0 + PKCE flow for connecting shoppers to their Shopify customer accounts, enabling post-purchase and order management features.

### Feature Specifications
- **Shopify OAuth**: Secure merchant authentication and app installation.
- **Store Management**: CRUD operations for merchant stores.
- **Knowledge Management**: CRUD for categorized shop knowledge entries.
- **Chat**: Real-time SSE streaming for AI chat interactions, persisting conversations. The chat route (`routes/chat.ts`) is a thin orchestrator that delegates to focused services: `conversation-service.ts` (load/create/persist conversations), `knowledge-cache.ts` (LRU-cached knowledge), `llm-context.ts` (message windowing + system prompt), `output-audit.ts` (async retraction), and `tool-guard.ts` (tool execution with fallback + response guarding).
- **Analytics**: Comprehensive merchant analytics dashboard with: conversation metrics, tool usage breakdown, conversion funnel (chat → cart → checkout → purchase), top recommended products, abandoned cart tracking, and estimated revenue from AI-assisted checkouts. Supports date range selection (7d, 30d, 90d, custom) with auto-refresh. Analytics events logged include `chat`, `tool_call`, `cart_created`, `checkout_started`, `checkout_completed`, and `product_recommended`. Enhanced API endpoint at `/stores/:storeDomain/analytics/enhanced` provides server-side aggregated data. CSV export endpoint at `/stores/:storeDomain/analytics/export` supports downloading analytics data as CSV files, with optional `sections` query param to export individual sections (overview, daily_chats, top_queries, tool_usage, conversion_funnel, top_products). Export events are logged with `analytics_exported` event type. Frontend provides split "Export CSV" button with dropdown for per-section export.
- **Preferences & Personalization**: User preferences (display name, units, budget, style, clothing sizes, material/brand/color preferences, lifestyle filters) are stored per session+store. Preferences are injected into the LLM system prompt for personalized responses. A regex-based preference extractor automatically detects and saves preferences mentioned in conversation (e.g., "I wear size 10"). The "What I remember" panel in the chat UI shows stored preferences with inline edit/delete controls.
- **Privacy & Data Management**: Full consent management, data export/deletion, and configurable data retention.
- **A/B Prompt Testing**: Merchants can conduct A/B prompt testing with configurable variants and analytics to determine optimal AI responses.
- **Voice Input**: Browser-native Web Speech API integration for voice-to-text chat input with recording indicator and graceful degradation.
- **Visual Product Search**: Image upload with camera capture for AI-powered product identification. Supports OpenAI and Gemini vision models. Images are processed server-side to generate product descriptions, then fed into the existing MCP product search flow.
- **LLM Provider System**: Decoupled LLM provider implementations with a factory for dynamic selection.
- **Universal Commerce Protocol (UCP)**: Dynamic capability negotiation per UCP 2026-01-11 spec. Discovery, DB persistence with configurable refresh, dynamic tool generation from advertised capabilities (checkout, orders, subscriptions, loyalty, discounts, preorders, wishlists, gifting), LLM context injection, graceful non-UCP fallback, and analytics logging.
- **Theme Integration**: Script-tag and iframe-based embedding options for various AI assistant functionalities directly within Shopify themes.
- **Customer Account MCP**: OAuth 2.0 + PKCE flow for connecting shoppers to their Shopify customer accounts via the Customer Accounts MCP endpoint. Discovered endpoints via `/.well-known/customer-account-api`, stores encrypted tokens in `mcp_connections` table, auto-refreshes expired tokens, and routes tool calls through the authenticated endpoint when available. Fallback to public Storefront MCP when not connected. Frontend shows a "Connect Account" button in the chat header with connection status badges and disconnect functionality. Client ID resolved per-store (`customer_account_client_id` column) or via global `SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID` env var. Requires `REPLIT_APP_URL` for OAuth callback URL.
- **Post-Purchase & Order Management**: Full order lifecycle support via UCP/MCP tools:
  - `get_orders` — List customer's recent orders with status and item details
  - `get_order_status` — Get detailed tracking information for a specific order
  - `request_return` — Initiate a return request with reason and item selection
  - Orders are fetched via authenticated Customer Account MCP when connected, falling back to UCP order tools
  - Order data is normalized via `order-service.ts` from various MCP/UCP response formats
  - Frontend renders `OrderCard` (order list), `OrderStatusCard` (visual progress bar: ordered→shipped→in transit→delivered), and `ReturnConfirmationCard` (return status)
  - All order interactions logged in analytics with event types: `order_history_query`, `order_status_query`, `return_request`
  - System prompt includes order & return handling instructions for the LLM

## Load & Stress Testing
- **Location**: `load-tests/` directory (workspace package `@workspace/load-tests`)
- **Scripts**: Node.js/TypeScript-based load test suite using native `fetch` and `node:http`
- **Tests available**:
  - `test:health` — Baseline throughput via health endpoint
  - `test:sessions` — Concurrent session creation load
  - `test:chat` — Concurrent chat with SSE streaming (10/25/50/100 sessions)
  - `test:sse` — SSE connection scalability limits
  - `test:db-pool` — Database connection pool exhaustion testing
  - `test:memory` — Memory stability over 15+ minutes sustained load
  - `test:rate-limit` — Per-client rate limiter correctness
  - `test:analytics` — Analytics aggregation query performance
  - `test:journey` — Full user journey simulation (session → chat → conversations)
  - `test:all` — Run all tests except memory (which runs separately)
- **Configuration**: Set `LOAD_TEST_URL`, `LOAD_TEST_STORE`, `LOAD_TEST_MERCHANT_PASSWORD` env vars
- **Results**: See `load-tests/RESULTS.md` for architecture analysis and bottleneck documentation

## External Dependencies
- **Shopify API**: For OAuth, store data, and platform interaction.
- **Shopify Storefront MCP**: For product search, cart management, and checkout.
- **Shopify Storefront GraphQL**: For additional store data (blogs, collections).
- **OpenAI SDK**: For OpenAI's large language models.
- **Anthropic SDK**: For Anthropic's large language models.
- **xAI (via OpenAI SDK)**: For xAI's models using an OpenAI SDK compatible interface.
