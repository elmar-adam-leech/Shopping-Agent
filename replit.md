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
│           ├── pages/             # Route pages (home, chat, settings, analytics)
│           ├── components/        # Reusable UI components
│           ├── hooks/             # Custom hooks (useSession, useChatStream)
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
├── scripts/
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Tables

- **stores**: `store_domain` (PK), `storefront_token`, `access_token`, `provider` (enum: openai/anthropic/xai), `model`, `api_key`, `created_at`
- **shop_knowledge**: `id`, `store_domain` (FK), `category` (enum: general/sizing/compatibility/required_accessories/restrictions/policies/custom), `title`, `content`, `sort_order`, timestamps
- **conversations**: `id`, `store_domain` (FK), `session_id`, `title`, `messages` (JSONB), timestamps
- **user_preferences**: `id`, `store_domain` (FK), `session_id`, `prefs` (JSONB), timestamps
- **analytics_logs**: `id`, `store_domain` (FK), `event_type`, `query`, `session_id`, `created_at`
- **sessions**: `id` (PK), `store_domain`, `created_at`, `expires_at` — shared table for both customer sessions (UUID, 24h TTL) and merchant sessions (`mtkn_*` prefix, 72h TTL)

## Key Architecture Decisions

### LLM Provider System
- Each provider has its own file in `src/services/llms/` with identical interface
- `llm-service.ts` is a tiny factory that dynamically imports the correct provider
- xAI uses the OpenAI SDK with `baseURL: "https://api.x.ai/v1"`
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
- Rate limiting: 10 req/min per session on chat endpoint
- API keys and tokens stored server-side only
- Cookie-parser middleware added to app.ts; custom fetch includes `credentials: 'include'`
- Auto-migration runs on server startup (`drizzle-kit push`)

### Chat Flow
- Frontend sends message via POST to `/api/stores/{domain}/chat`
- Backend streams SSE events: text deltas, tool_call, tool_result, done
- MCP tool calls go to `https://{domain}/api/mcp` via JSON-RPC
- Conversations persisted in JSONB messages column

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned by Replit)
- `SHOPIFY_API_KEY` — Shopify app API key (optional, for OAuth flow)
- `SHOPIFY_API_SECRET` — Shopify app API secret (optional, for OAuth flow)
- `APP_URL` — Public URL of the app (optional, for OAuth callbacks)

## Commands

- `pnpm run typecheck` — Full typecheck
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API hooks/schemas
- `pnpm --filter @workspace/db run push` — Push schema to database
- `pnpm --filter @workspace/api-server run dev` — Run API server
- `pnpm --filter @workspace/shopify-agent run dev` — Run frontend
