# Shopify MCP AI Shopping Agent

## Overview
This project is a multi-tenant Shopify AI Shopping Agent designed to enhance e-commerce customer interactions. It allows merchants to configure an AI assistant with their store's knowledge, enabling customers to chat for product search, cart management, and checkout. The agent integrates with Shopify's Storefront MCP and supports various LLM providers. Its core purpose is to provide an intelligent, automated shopping assistant that streamlines the customer journey and leverages advanced AI capabilities within the Shopify ecosystem. The project aims to become a leading AI solution for Shopify merchants, offering a seamless and personalized shopping experience that drives sales and customer satisfaction.

## Engineering Standards
This project follows 14 universal engineering standards defined in `MY_STANDARDS.md` at the project root. All agents and contributors must read and follow these standards. Key standards include:
- **Real implementations only** — no mocks, fakes, or placeholders in production code
- **Soft delete over hard delete** — use `deleted_at` columns, never permanently erase user data
- **Audit trails** — log all mutations to important data with who/what/when
- **Centralize shared logic** — no duplicate code across packages
- **TypeScript strict mode** — zero `any` casts, strict enabled everywhere
- **Dark mode** — all UI must support dark mode with a user toggle
- **Security defaults** — HTTP-only cookies, encrypted secrets, scoped tokens, input validation
- **Background work survives restarts** — graceful shutdown, persistent job queues
- **Mobile-first** — test at 375px, 44×44px touch targets
- **One source of truth** — no dual-write patterns, clear data ownership

A gap analysis against these standards is documented in `STANDARDS_AUDIT.md`.

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
The frontend is built with React 18, Vite, Tailwind CSS, and shadcn/ui, providing a modern and responsive user interface. The design prioritizes clarity and ease of use for both merchants configuring the agent and customers interacting with it. Key UI components include chat interfaces, settings panels for merchant configuration, and analytics dashboards. Embed modes are designed to seamlessly integrate into existing Shopify themes, maintaining the store's aesthetic.

### Technical Implementations
- **Monorepo**: pnpm workspaces for managing multiple packages (API server, frontend, shared libraries).
- **Backend**: Express 5 serving as the API server.
- **Database**: PostgreSQL with Drizzle ORM for data persistence.
- **LLM Integration**: Multi-provider support (OpenAI, Anthropic, xAI) with a unified interface. LLM API keys are encrypted at rest using AES-256-GCM (requires `ENCRYPTION_KEY` env var — 64 hex chars / 32 bytes). Keys are encrypted on store create/update and decrypted before LLM calls. Plaintext legacy keys are supported for reads but new writes require encryption to be configured.
- **API Communication**: Orval for OpenAPI-based API codegen, ensuring type-safe client-server interaction.
- **Multi-Tenancy**: Every backend route and DB query is scoped by `store_domain` for secure multi-tenant operation.
- **Session Management**: Customer and merchant sessions are persisted in the database with defined TTLs. OAuth pending states are also stored in the DB (`pending_oauth_states` table) for horizontal scaling support.
- **Shop Knowledge**: Merchants can input structured knowledge that is dynamically injected into the LLM's system prompt for contextual responses.
- **UCP Compliance**: Full support for Universal Commerce Protocol (UCP) for standardized agentic commerce capabilities (discovery, checkout primitives, order tracking).
- **Theme Embeds**: Various embed modes (Chat, AI Search, Contextual Assistant, Product Assistant) are available for native integration into Shopify themes via script tags or iframes.
- **Chat Widget**: A Shopify theme app extension provides a customizable chat widget with merchant-controlled enable/disable toggles.
- **"Shop For Me" Page**: A public-facing full-page chat interface available at `/shop/{storeDomain}`.
- **Performance & Caching**: LRU caches with hit/miss monitoring for stores, sessions, knowledge, MCP tools, and UCP discovery. Conversation messages use atomic JSONB append with a 200-message cap and automatic truncation. MCP tools/list and UCP discovery run in parallel with a circuit breaker (5 failures → 5min cooldown). Analytics queries backed by composite indexes on (store_domain, created_at, event_type), partial index on non-null queries, and session_id index.
- **Rate Limiting**: Implemented on chat endpoints to prevent abuse.
- **Security**: HMAC verification, strict body size limits, CORS configuration, and a global error handler. LLM tool-call loop has a configurable max-iterations guard (default 10). Markdown rendering is sanitized with DOMPurify to prevent XSS. Dev auth endpoint requires `DEV_AUTH_SECRET` env var. Session IDs in conversation routes use middleware-validated values. User messages are truncated to 10,000 chars before DB insertion. SSE parser failedLines set is bounded to 50 entries.

### Feature Specifications
- **Shopify OAuth**: Secure merchant authentication and app installation.
- **Store Management**: CRUD operations for merchant stores.
- **Knowledge Management**: CRUD for categorized shop knowledge entries.
- **Chat**: Real-time SSE streaming for AI chat interactions, persisting conversations.
- **Analytics**: Logging and retention of analytics data for merchant insights.
- **Preferences**: Storage of user preferences.
- **LLM Provider System**: Decoupled LLM provider implementations with a factory for dynamic selection.
- **Universal Commerce Protocol (UCP)**: Integration with UCP for enhanced commerce capabilities, including discovery and standardized checkout tools.
- **Theme Integration**: Script-tag and iframe-based embedding options for various AI assistant functionalities directly within Shopify themes.
- **Customer Account MCP**: OAuth 2.0 + PKCE flow for connecting shoppers to their Shopify customer accounts via the Customer Accounts MCP endpoint. Discovers endpoints via `/.well-known/customer-account-api`, stores encrypted tokens in `mcp_connections` table, auto-refreshes expired tokens, and routes tool calls through the authenticated endpoint when available. Fallback to public Storefront MCP when not connected. Frontend shows a "Connect Account" button in the chat header with connection status badges and disconnect functionality. Client ID resolved per-store (`customer_account_client_id` column) or via global `SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID` env var. Requires `REPLIT_APP_URL` for OAuth callback URL.

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
- **Shopify API**: For OAuth, accessing store data, and interacting with the Shopify platform.
- **Shopify Storefront MCP**: JSON-RPC client for product search, cart management, and checkout operations.
- **Shopify Storefront GraphQL**: For fetching additional store data like blogs and collections.
- **OpenAI SDK**: Integration with OpenAI's large language models.
- **Anthropic SDK**: Integration with Anthropic's large language models.
- **xAI (via OpenAI SDK)**: Integration with xAI's models using the OpenAI SDK compatible interface.
- **PostgreSQL**: Relational database for persistent storage.