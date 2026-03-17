# Shopify MCP AI Shopping Agent

## Overview

A multi-tenant Shopify AI Shopping Agent built as a full-stack React + Vite + Express application. Merchants install the app, configure their LLM provider (OpenAI, Anthropic, or Grok/xAI), and add shop knowledge. Customers chat with an AI assistant that uses Shopify's Storefront MCP for product search, cart management, and checkout.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React 18 + Vite + wouter + Tailwind + shadcn/ui
- **Backend**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **LLM**: Multi-provider (OpenAI SDK, Anthropic SDK, xAI via OpenAI SDK)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/                 # Express API server
│   │   └── src/
│   │       ├── routes/             # API route handlers
│   │       │   ├── auth.ts         # Shopify OAuth install/callback
│   │       │   ├── stores.ts       # Store CRUD
│   │       │   ├── knowledge.ts    # Shop knowledge CRUD
│   │       │   ├── chat.ts         # SSE streaming chat
│   │       │   ├── conversations.ts# Conversation history
│   │       │   ├── preferences.ts  # User preferences
│   │       │   ├── analytics.ts    # Analytics dashboard data
│   │       │   ├── sessions.ts     # Session management
│   │       │   └── health.ts       # Health check
│   │       ├── services/
│   │       │   ├── llms/           # LLM provider implementations
│   │       │   │   ├── openai.ts   # OpenAI SDK streaming + tool calling
│   │       │   │   ├── anthropic.ts# Anthropic SDK streaming + tool calling
│   │       │   │   └── xai.ts      # xAI/Grok via OpenAI SDK (baseURL override)
│   │       │   ├── llm-service.ts  # Tiny factory: reads provider → returns correct LLM
│   │       │   ├── mcp-client.ts   # JSON-RPC client for Shopify Storefront MCP
│   │       │   ├── graphql-client.ts# Shopify Storefront GraphQL for blogs/collections
│   │       │   ├── system-prompt.ts # Dynamic system prompt builder with shop knowledge
│   │       │   └── tenant-validator.ts # Store domain validation middleware
│   │       └── app.ts             # Express app setup with rate limiting
│   └── shopify-agent/             # React + Vite frontend
│       └── src/
│           ├── pages/             # Route pages (home, chat, settings, analytics, shop-for-me, embed-*)
│           ├── components/        # Reusable UI components
│           ├── hooks/             # Custom hooks (useSession, useChatStream, useEmbedMode)
│           └── store/             # Zustand stores (cart)
├── lib/
│   ├── api-spec/                  # OpenAPI 3.1 spec + Orval codegen config
│   ├── api-client-react/          # Generated React Query hooks
│   ├── api-zod/                   # Generated Zod schemas
│   └── db/                        # Drizzle ORM schema + DB connection
│       └── src/schema/
│           ├── stores.ts          # stores table (domain, tokens, provider, model, api_key)
│           ├── knowledge.ts       # shop_knowledge table (categorized entries)
│           ├── conversations.ts   # conversations table (JSONB messages)
│           ├── preferences.ts     # user_preferences table (JSONB prefs)
│           └── analytics.ts       # analytics_logs table
├── extensions/
│   └── chat-widget/              # Shopify theme app extension
│       ├── shopify.extension.toml # Extension config
│       ├── blocks/
│       │   └── chat-widget.liquid # Liquid block with schema settings
│       ├── assets/
│       │   ├── chat-widget.css   # Widget styles
│       │   └── chat-widget.js    # Self-contained vanilla JS widget
│       └── preview.html          # Standalone preview/demo page
├── scripts/
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Tables

- **stores**: `store_domain` (PK), `storefront_token`, `access_token`, `provider` (enum: openai/anthropic/xai), `model`, `api_key`, `ucp_compliant` (boolean, default true), `chat_enabled` (boolean, default true), `embed_enabled` (boolean, default false), `created_at`
- **shop_knowledge**: `id`, `store_domain` (FK), `category` (enum: general/sizing/compatibility/required_accessories/restrictions/policies/custom), `title`, `content`, `sort_order`, timestamps
- **conversations**: `id`, `store_domain` (FK), `session_id`, `title`, `messages` (JSONB), timestamps
- **user_preferences**: `id`, `store_domain` (FK), `session_id`, `prefs` (JSONB), timestamps
- **analytics_logs**: `id`, `store_domain` (FK), `event_type`, `query`, `session_id`, `created_at`
- **sessions**: `id` (PK), `store_domain`, `created_at`, `expires_at` — shared table for both customer sessions (UUID, 24h TTL) and merchant sessions (`mtkn_*` prefix, 72h TTL)

## Key Architecture Decisions

### LLM Provider System
- Each provider has its own file in `src/services/llms/` with identical interface
- `llm-service.ts` is a tiny factory that dynamically imports the correct provider
- xAI reuses the OpenAI streaming implementation via a `baseURL` parameter
- API keys stored server-side only in the database, never exposed to the frontend

### Shop Knowledge
- Merchants add structured knowledge entries (sizing rules, compatibility, required accessories, etc.)
- Knowledge is organized by category and injected into the AI system prompt
- The system prompt builder assembles knowledge entries into the LLM context

### Multi-Tenancy & Security
- Every backend route validates `store_domain` parameter via `validateStoreDomain` middleware
- Every DB query filters by `store_domain`
- Chat and conversation routes require valid session via `validateSession` middleware (customer sessions)
- Sessions are persisted in the `sessions` table with 24-hour TTL and scoped to store domain
- **Merchant auth**: Admin routes (stores CRUD, knowledge CRUD, analytics) protected by `validateMerchantAuth` / `validateMerchantAuthForStoreList` middleware in `merchant-auth.ts`
  - Merchant tokens prefixed `mtkn_`, stored in sessions table with 72h TTL
  - Token sent via httpOnly cookie (`merchant_token`) set during OAuth callback or dev login
  - `POST /auth/login` (dev-only, disabled in production) allows login by store domain
  - `POST /stores` enforces tenant binding: merchant can only create stores for their own domain
  - `GET /stores` scoped to authenticated merchant's domain only
- Rate limiting: 10 req/min per IP/session on chat endpoint (uses `x-session-id` header or IP, not user-controlled body)
- HMAC verification uses timing-safe comparison
- Request body size limited to 1MB
- CORS origin configurable via `ALLOWED_ORIGINS` env var (comma-separated)
- Global Express error handler catches unhandled exceptions
- SSE streaming handles client disconnects gracefully
- API keys and tokens stored server-side only
- Cookie-parser middleware added to app.ts; custom fetch includes `credentials: 'include'`
- Auto-migration runs on server startup (`drizzle-kit push`)

### Chat Widget Toggle
- Merchants can enable/disable the chat widget from the Settings page via a `chat_enabled` toggle
- When disabled, both the theme extension widget and the "Shop For Me" page return 403 errors
- Session creation (`POST /sessions`) and chat (`POST /stores/:domain/chat`) both enforce this check server-side
- The theme extension widget handles 403 "chat disabled" gracefully, showing "Chat is currently unavailable"

### Shop For Me Page
- Public-facing full-page chat at `/shop/{storeDomain}` — no merchant auth required
- Auto-creates a customer session with TTL tracking and expiry-based refresh
- Supports `?embed=true` query param for iframe embedding (removes header chrome)
- Merchants can link to this page from their Shopify store navigation
- Respects the `chat_enabled` toggle (shows "unavailable" message if disabled)
- Public store info available via `GET /api/stores/:storeDomain/public` (returns only storeDomain and chatEnabled)

### Chat Flow
- Frontend sends message via POST to `/api/stores/{domain}/chat`
- Backend streams SSE events: text deltas, tool_call, tool_result, done
- MCP tool calls go to `https://{domain}/api/mcp` via JSON-RPC
- Conversations persisted in JSONB messages column

## UCP (Universal Commerce Protocol) Compliance

ShopMCP is a fully UCP-compliant Shopify Agent. It uses the same Universal Commerce Protocol (via MCP) that Shopify provides. UCP is an open standard (co-developed by Google and Shopify) for agentic commerce that standardizes discovery, checkout, orders, and payment flows across AI agents.

### UCP Features
- **Discovery**: Fetches `/.well-known/ucp` from store domains to discover UCP capabilities, services, transports, and payment handlers
- **Checkout Primitives**: Exposes `create_checkout`, `update_checkout`, `complete_checkout` as MCP tools when UCP is discovered
- **Order Tracking**: Exposes `get_order_status` for post-purchase order tracking
- **Capability Caching**: UCP discovery documents are cached in-memory with a 5-minute TTL per store domain
- **Graceful Fallback**: If a store doesn't support UCP, the agent continues with standard MCP tools without errors
- **Per-Store Toggle**: Each store has a `ucp_compliant` boolean (default `true`) that can be toggled in the Settings page
- **UCP Headers**: When UCP is active, all MCP tool calls include the `UCP-Version: 2026-01-11` header
- **System Prompt Integration**: When UCP capabilities are discovered, they are injected into the LLM system prompt so the model knows which UCP primitives are available

### UCP Spec Reference
- Spec: https://ucp.dev/specification/overview/
- Version: `2026-01-11`

## Theme Embed Integration

ShopMCP supports native Shopify theme integration via embed routes and a loader script.

### Embed Modes
- **Embed Chat** (`/embed/:storeDomain/chat`) — Full chromeless chat panel for theme sections
- **AI Search** (`/embed/:storeDomain/search`) — AI-powered search bar streaming product results
- **Contextual Assistant** (`/embed/:storeDomain/assistant`) — "Ask AI" button with pre-loaded context
- **Product Assistant** (`/embed/:storeDomain/product/:productHandle`) — Inline collapsible AI panel for product pages

### Embed Components
- `EmbedChatPanel` — Reusable chat panel (no app chrome) accepting storeDomain + context props
- `AISearchBar` — Search input streaming AI product results as ProductCard components
- `ContextualAssistantButton` — Compact "Ask AI" button expanding to EmbedChatPanel
- `ProductAssistant` — Collapsible product-specific AI assistant panel

### Usage
1. **Script Tag** (recommended): Add to `theme.liquid`:
   ```html
   <script src="https://YOUR_APP_URL/embed.js"
     data-store-domain="{{ shop.permanent_domain }}"
     data-mode="chat">
   </script>
   ```
2. **Iframe Embed**: For custom sections / headless:
   ```html
   <iframe src="https://YOUR_APP_URL/embed/STORE.myshopify.com/chat?mode=embed"
     style="width:100%;height:600px;border:none;border-radius:12px;">
   </iframe>
   ```
3. **Product Pages**: Pass product context:
   ```html
   <script src="https://YOUR_APP_URL/embed.js"
     data-store-domain="{{ shop.permanent_domain }}"
     data-mode="product"
     data-product-handle="{{ product.handle }}">
   </script>
   ```

### Data Attributes
- `data-store-domain` — Required. Shopify permanent domain
- `data-mode` — `chat` | `search` | `assistant` | `product`
- `data-position` — `bottom-right` | `bottom-left` | `top-right` | `top-left`
- `data-product-handle` — Product handle for product mode
- `data-collection-handle` — Collection handle for context
- `data-cart-token` — Cart token for cart context
- `data-width` / `data-height` — Custom dimensions
- `data-container` — ID of existing DOM element to embed into

### Store Controls
- `chat_enabled` toggle (default: true) — When disabled, chat endpoints return 403
- `embed_enabled` toggle (default: false) — Controls theme embed section in settings

### Contextual Data
Chat requests accept an optional `context` object with `productHandle`, `collectionHandle`, `cartToken`, and `searchMode`. Context is injected into the LLM system prompt.

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned by Replit)
- `SHOPIFY_API_KEY` — Shopify app API key (optional, for OAuth flow)
- `SHOPIFY_API_SECRET` — Shopify app API secret (optional, for OAuth flow)
- `APP_URL` — Public URL of the app (optional, for OAuth callbacks)
- `ALLOWED_ORIGINS` — Comma-separated list of allowed CORS origins (optional, defaults to all)

## Commands

- `pnpm run typecheck` — Full typecheck
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API hooks/schemas
- `pnpm --filter @workspace/db run push` — Push schema to database
- `pnpm --filter @workspace/api-server run dev` — Run API server
- `pnpm --filter @workspace/shopify-agent run dev` — Run frontend
