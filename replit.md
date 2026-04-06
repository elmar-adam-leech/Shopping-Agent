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

**Rich Multi-Modal Chat Rendering**: The chat interface includes several interactive components for an enhanced shopping experience:
- **Product Carousel**: Horizontal scrollable carousel with arrow navigation and CSS snap for 3+ product results (replaces vertical stack). Supports swipe on mobile.
- **Quick Add-to-Cart**: Every ProductCard has an "Add to Cart" button that directly invokes the MCP `add_to_cart` / `create_cart` tool via a dedicated backend endpoint (`POST /stores/:storeDomain/cart/quick-add`). Button shows loading/success/error states tied to actual server response.
- **Comparison Table**: Side-by-side comparison of 2-4 products (price, vendor, availability) triggered by `compare_products` tool or `_renderHint: "comparison"` in tool responses.
- **Inline Cart Summary**: After add-to-cart tool calls, a compact summary card shows item count, subtotal, and "View Cart" button.
- **Product Image Gallery**: Expandable thumbnail strip + main image viewer for products with multiple images.
- **Interactive Collection Cards**: Clicking a collection card sends a follow-up message to browse that collection's products.
- **ChatActionsContext**: React context (`contexts/chat-actions-context.tsx`) provides `sendMessage`, `quickAddToCart`, and `isLoading` to deeply nested chat components without prop drilling.
- **Direct Cart API**: Backend endpoint `POST /stores/:storeDomain/cart/quick-add` in `artifacts/api-server/src/routes/cart.ts` directly invokes MCP tools for deterministic cart operations.

### Shared UI Components & Utilities
- **ToolBadge** (`components/ui/tool-badge.tsx`): Unified tool call badge with `variant` prop — `"detailed"` (with add-to-cart special state, used by MessageBubble) and `"compact"` (indigo pill style, used by shop-for-me page).
- **LoadingOverlay** (`components/ui/loading-overlay.tsx`): Shared spinner + optional error/retry state. Used by App.tsx (Suspense fallback), chat.tsx, analytics.tsx, and EmbedChatPanel.
- **EntityCard** (`components/ui/entity-card.tsx`): Common card container with image + content layout. Used by ArticleCard.
- **AgentAvatar** (`components/ui/agent-avatar.tsx`): Reusable agent icon container with configurable size (sm/md/lg), variant (subtle/gradient), and optional children. Used in chat.tsx header, EmbedChatPanel.tsx empty state, and home.tsx hero.
- **Error Utilities** (`lib/error-utils.ts`): Centralized `toFriendlyError` (user-facing error mapping) and `httpStatusToError` (HTTP status code mapping). Used by install.tsx and use-chat-stream.ts.

### Technical Implementations
- **Monorepo**: pnpm workspaces for managing multiple packages (API server, frontend, shared libraries).
- **Backend**: Express 5 serving as the API server.
- **Database**: PostgreSQL with Drizzle ORM for data persistence.
- **LLM Integration**: Multi-provider support (OpenAI, Anthropic, xAI, Google Gemini) with a unified interface. LLM API keys are encrypted at rest using AES-256-GCM (requires `ENCRYPTION_KEY` env var — 64 hex chars / 32 bytes). Keys are encrypted on store create/update and decrypted before LLM calls. Plaintext legacy keys are supported for reads but new writes require encryption to be configured.
- **API Communication**: Orval for OpenAPI-based API codegen, ensuring type-safe client-server interaction.
- **Multi-Tenancy**: Every backend route and DB query is scoped by `store_domain` for secure multi-tenant operation.
- **Session Management**: Customer and merchant sessions are persisted in the database with defined TTLs. OAuth pending states are also stored in the DB (`pending_oauth_states` table) for horizontal scaling support.
- **Shop Knowledge**: Merchants can input structured knowledge that is dynamically injected into the LLM's system prompt for contextual responses. Bulk import supports pasting markdown content or uploading .md/.txt files, automatically splitting by headings into separate entries.
- **Brand Voice & Customization**: Merchants can define a brand voice profile (tone: friendly/professional/playful/luxury, personality description, greeting style, sign-off style) that shapes all AI responses. Custom free-form instructions are injected into the system prompt. Welcome messages greet customers when opening the chat. Product recommendation strategies (personalized, bestsellers-first, new-arrivals-first, price-low-to-high) guide how the AI suggests products. Settings stored in stores table: `brand_voice` (jsonb), `custom_instructions` (text), `welcome_message` (text), `recommendation_strategy` (enum).
- **UCP Dynamic Capability Negotiation**: Full UCP 2026-01-11 spec support with dynamic capability discovery. At session start, the agent fetches `/.well-known/ucp`, parses all service types and nested capabilities (checkout, orders, subscriptions, loyalty, discounts, preorders, wishlists, gifting), and dynamically generates tool definitions. Discovered capabilities are persisted per store in `ucp_capabilities` jsonb column with configurable refresh intervals (default 1 hour). The LLM system prompt includes the store's negotiated capabilities so it only offers features the store advertises. Non-UCP stores gracefully fall back to Storefront MCP/GraphQL. Negotiation outcomes are logged to analytics for debugging. UCP metadata is sanitized before prompt inclusion to prevent injection.
- **Theme Embeds**: Various embed modes (Chat, AI Search, Contextual Assistant, Product Assistant) are available for native integration into Shopify themes via script tags or iframes.
- **Chat Widget**: A Shopify theme app extension provides a customizable chat widget with merchant-controlled enable/disable toggles.
- **"Shop For Me" Page**: A public-facing full-page chat interface available at `/shop/{storeDomain}`.
- **Performance & Caching**: LRU caches with hit/miss monitoring for stores, sessions, knowledge, MCP tools, and UCP discovery. Conversation messages use atomic JSONB append with a 200-message cap and automatic truncation. MCP tools/list and UCP discovery run in parallel with a circuit breaker (5 failures → 5min cooldown). Analytics queries backed by composite indexes on (store_domain, created_at, event_type), partial index on non-null queries, and session_id index.
- **Middleware Organization**: All middleware lives in `artifacts/api-server/src/middleware/` with a barrel `index.ts` re-export. Includes tenant validation, session validation, merchant auth, rate limiters, cache-control, request logging, and gzip compression. Route files import from `../middleware` instead of `../services` directly.
- **Request Logging**: Structured request logger logs method, path, status code, and response time with `[request]` prefix. Health check endpoints are skipped to reduce noise.
- **Compression**: Gzip compression via the `compression` package, applied globally but skipped for `text/event-stream` (SSE) responses to avoid buffering delays.
- **Rate Limiting**: Implemented on chat endpoints to prevent abuse.
- **Security**: HMAC verification, strict body size limits, CORS configuration, and a global error handler. LLM tool-call loop has a configurable max-iterations guard (default 10). Markdown rendering is sanitized with DOMPurify to prevent XSS. Dev auth endpoint requires `DEV_AUTH_SECRET` env var. Session IDs in conversation routes use middleware-validated values. User messages are truncated to 10,000 chars before DB insertion. SSE parser failedLines set is bounded to 50 entries.
- **Prompt Injection Guard**: Layered defense system in `artifacts/api-server/src/services/prompt-guard.ts`:
  - **Layer 1 (Regex)**: Fast deterministic pattern matching against ~25 known injection patterns. Blocks instantly on match.
  - **Layer 2 (LLM Classifier)**: Uses Replit AI integrations proxy (gpt-5-nano) for intent-based classification. Configurable confidence thresholds per sensitivity level (low=0.9, medium=0.7, high=0.4). Fail-open on timeout (2s) or errors. Does NOT use the merchant's API key or provider — free internal service.
  - **Layer 3 (System Prompt Hardening)**: Explicit refusal instructions appended to every system prompt (refuse role changes, refuse prompt leaking, refuse instruction override).
  - **Tool Response Scanning**: MCP/UCP tool results are scanned for indirect injection before being fed back to the LLM.
  - **Async Output Auditing**: After response persistence, the assistant's output is audited for hallucinated claims, data leakage, and blocked topic violations. Flagged responses are retracted (stored message replaced, SSE retraction event pushed to frontend).
  - **Merchant Controls**: `guard_sensitivity` (off/low/medium/high) and `blocked_topics` (text array) columns in stores table, exposed in settings UI.
  - **Analytics**: Injection attempts logged with event types `prompt_injection_regex`, `prompt_injection_llm`, `tool_injection_llm`, `blocked_topic`, `output_retracted` with metadata in analytics_logs table.

### Feature Specifications
- **Shopify OAuth**: Secure merchant authentication and app installation.
- **Store Management**: CRUD operations for merchant stores.
- **Knowledge Management**: CRUD for categorized shop knowledge entries.
- **Chat**: Real-time SSE streaming for AI chat interactions, persisting conversations. The chat route (`routes/chat.ts`) is a thin orchestrator that delegates to focused services: `conversation-service.ts` (load/create/persist conversations), `knowledge-cache.ts` (LRU-cached knowledge), `llm-context.ts` (message windowing + system prompt), `output-audit.ts` (async retraction), and `tool-guard.ts` (tool execution with fallback + response guarding).
- **Analytics**: Comprehensive merchant analytics dashboard with: conversation metrics, tool usage breakdown, conversion funnel (chat → cart → checkout → purchase), top recommended products, abandoned cart tracking, and estimated revenue from AI-assisted checkouts. Supports date range selection (7d, 30d, 90d) with auto-refresh. Analytics events logged include `chat`, `tool_call`, `cart_created`, `checkout_started`, `checkout_completed`, and `product_recommended`. Enhanced API endpoint at `/stores/:storeDomain/analytics/enhanced` provides server-side aggregated data.
- **Preferences**: Storage of user preferences.
- **LLM Provider System**: Decoupled LLM provider implementations with a factory for dynamic selection.
- **Universal Commerce Protocol (UCP)**: Dynamic capability negotiation per UCP 2026-01-11 spec. Discovery, DB persistence with configurable refresh, dynamic tool generation from advertised capabilities (checkout, orders, subscriptions, loyalty, discounts, preorders, wishlists, gifting), LLM context injection, graceful non-UCP fallback, and analytics logging.
- **Theme Integration**: Script-tag and iframe-based embedding options for various AI assistant functionalities directly within Shopify themes.
- **Customer Account MCP**: OAuth 2.0 + PKCE flow for connecting shoppers to their Shopify customer accounts via the Customer Accounts MCP endpoint. Discovers endpoints via `/.well-known/customer-account-api`, stores encrypted tokens in `mcp_connections` table, auto-refreshes expired tokens, and routes tool calls through the authenticated endpoint when available. Fallback to public Storefront MCP when not connected. Frontend shows a "Connect Account" button in the chat header with connection status badges and disconnect functionality. Client ID resolved per-store (`customer_account_client_id` column) or via global `SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID` env var. Requires `REPLIT_APP_URL` for OAuth callback URL.
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
- **Shopify API**: For OAuth, accessing store data, and interacting with the Shopify platform.
- **Shopify Storefront MCP**: JSON-RPC client for product search, cart management, and checkout operations.
- **Shopify Storefront GraphQL**: For fetching additional store data like blogs and collections.
- **OpenAI SDK**: Integration with OpenAI's large language models.
- **Anthropic SDK**: Integration with Anthropic's large language models.
- **xAI (via OpenAI SDK)**: Integration with xAI's models using the OpenAI SDK compatible interface.
- **PostgreSQL**: Relational database for persistent storage.