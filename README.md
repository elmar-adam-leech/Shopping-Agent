# Shopping-Agent

**A secure, multi-tenant AI Shopping Agent powered by Shopify's native UCP-compliant MCP endpoints.**

This project delivers a natural-language conversational commerce experience that connects to any Shopify store. Users chat with an intelligent agent that discovers products/collections, manages carts, remembers preferences, and drives checkout using **UCP-compliant MCP tools** (Storefront MCP + Checkout MCP) first, with Storefront GraphQL fallbacks for rich content like blogs and metaobjects.

Built as a **Replit-friendly TypeScript monorepo** with strong emphasis on:
- **Multi-tenancy** via `store_domain` isolation
- **UCP interoperability** for agentic commerce (discovery, negotiation, transaction)
- **Security & compliance** (tenant validation on every call, encrypted tokens, prompt injection protection)
- **Rich UX** in the chat widget (streaming responses + interactive product/collection cards)

## Architecture

```
Shopping-Agent/
├── artifacts/
│   ├── api-server/              # Express 5 backend (MCP client, LLM orchestration, merchant auth, sessions, routes)
│   ├── shopify-agent/           # React 18 frontend (Vite + Tailwind CSS + shadcn/ui + wouter + Zustand + TanStack Query)
│   └── mockup-sandbox/          # Dev preview / component sandbox
├── lib/
│   ├── db/                      # Drizzle ORM schema & migrations
│   ├── api-spec/                # OpenAPI specification
│   ├── api-client-react/        # Generated React hooks (Orval)
│   └── api-zod/                 # Generated Zod schemas (Orval)
├── extensions/
│   └── chat-widget/             # Shopify Theme App Extension (vanilla HTML/CSS/JS + Liquid blocks)
├── load-tests/                  # Performance & stress testing suite
├── scripts/                     # Automation & maintenance scripts
├── pnpm-workspace.yaml
├── package.json
└── tsconfig*.json
```

**Key Principles**
- **UCP-first**: Always prefer Shopify's native MCP endpoints (`https://{shop}.myshopify.com/api/mcp`) and Checkout MCP for cart/checkout. Use UCP capability negotiation via `/.well-known/ucp` and JSON-RPC 2.0.
- **Multi-tenancy**: Database queries, MCP calls, and API routes filter by `store_domain`. Strict application-level filtering enforced via middleware and query patterns.
- **Security**: Least-privilege tokens, shop-origin validation, encrypted storage, prompt injection protection, no cross-tenant data leaks.
- **AI Layer**: LLM tool-calling with streaming responses via a provider-agnostic adapter pattern.
- **Persistence**: PostgreSQL + Drizzle ORM for conversations, user preferences, analytics, and tenant metadata. Anonymous `session_id` + `store_domain` partitioning.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Monorepo**: pnpm workspaces
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React 18 + Vite + Tailwind CSS + shadcn/ui (Radix UI) + wouter (router) + Zustand (state) + TanStack Query (data fetching)
- **Backend**: Express 5 + TypeScript (MCP client, LLM orchestration, merchant auth, session management)
- **Chat Widget**: Vanilla HTML/CSS/JavaScript as a Shopify Theme App Extension with Liquid blocks
- **LLM Providers**: OpenAI, Anthropic, and xAI via a provider-agnostic adapter pattern (default model: `gpt-4o`)
- **Commerce**: Shopify Storefront MCP (JSON-RPC 2.0), UCP-compliant Checkout MCP, Storefront GraphQL fallback
- **Auth**: Shopify OAuth (merchant), MCP Customer Accounts OAuth (shopper)
- **Deployment**: Replit

## Quick Start (Replit)

1. Open the repo in Replit.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Set environment variables (via Replit Secrets):
   - `DATABASE_URL` (PostgreSQL connection string)
   - `ENCRYPTION_KEY` (64 hex characters / 32 bytes for AES-256-GCM)
   - `OPENAI_API_KEY` (or per-tenant encrypted keys)
   - `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` (for OAuth)
   - Per-tenant Shopify/MCP credentials (handled securely per `store_domain`)
4. Run the development servers (see `package.json` scripts or `scripts/` for details).
5. Add your first tenant via the onboarding flow (validates MCP endpoint + UCP manifest).

## Adding a New Tenant / Shopify Store

1. Provide `store_domain` (e.g., `your-store.myshopify.com`).
2. Validate MCP endpoint reachability (`/api/mcp` tools/list).
3. Fetch and store UCP manifest from `/.well-known/ucp`.
4. Store encrypted access tokens per tenant.
5. All subsequent operations are automatically scoped to that `store_domain`.

**Important**: Backend handlers and Drizzle queries should include `where: eq(table.store_domain, req.storeDomain)` to maintain tenant isolation.

## Core Features

- **MCP Customer Accounts OAuth** (PKCE-based, encrypted token storage, auto-refresh)
- **Chat with streaming** (SSE-based real-time AI responses with interactive product/collection cards)
- **Merchant dashboard** (store settings, knowledge management, analytics)
- **Multi-provider LLM support** (OpenAI, Anthropic, xAI with runtime provider selection)
- **Shop knowledge injection** (merchant-defined knowledge injected into LLM system prompts)
- **Prompt injection protection** (sanitization filter active in chat route, blocking guard available)
- **Load testing suite** (health, sessions, chat, SSE, DB pool, memory, rate limits, analytics, user journeys)
- **"Shop For Me" page** (public-facing full-page chat interface at `/shop/{storeDomain}`)
- **Theme embed modes** (Chat, AI Search, Contextual Assistant, Product Assistant)

## UCP & MCP Usage Guidelines

- **Discovery**: Use `tools/list` on Storefront MCP or `/.well-known/ucp`
- **Checkout**: Prefer Checkout MCP with the configured UCP version. Include agent profile `meta["ucp-agent"]`.
- **Negotiation**: Handle `requires_escalation` gracefully and support Embedded Commerce Protocol (ECP).
- **Fallback**: Use Storefront GraphQL only for rich non-tool content (blogs, metaobjects, detailed collections).

Reference:
- [UCP Specification](https://ucp.dev/)
- [Shopify Agentic Commerce Docs](https://shopify.dev/docs/agents)
- [Storefront MCP](https://shopify.dev/docs/apps/build/storefront-mcp)

## Security & Best Practices

- Validate `store_domain` on incoming requests and DB queries.
- Never share state across tenants.
- Encrypt sensitive tokens (LLM API keys, Shopify access tokens) with AES-256-GCM.
- Prompt injection sanitization on chat inputs, with blocking guard available.
- Per-endpoint rate limiting on public routes.
- Timing-safe comparisons for HMAC and secret verification.
- Error sanitization — no internal details leaked to clients.
- Analytics logging for MCP/UCP calls and agent actions.

See [SECURITY.md](SECURITY.md) for detailed security architecture documentation.

## Development Workflow

- Use TypeScript strictly.
- Follow existing patterns in `lib/` and `artifacts/`.
- Add tests for tenant isolation and UCP negotiation.
- Run load tests before major changes.

## Contributing

1. Create a branch for your task (e.g., `feature/ucp-checkout`).
2. Ensure all changes include `store_domain` filtering.
3. Update this README if architecture changes.
4. Test with at least two different test stores.

## License

MIT
