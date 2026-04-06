# Shopify MCP AI Shopping Agent

## Overview
This project is a multi-tenant Shopify AI Shopping Agent designed to enhance e-commerce customer interactions. It allows merchants to configure an AI assistant with their store's knowledge, enabling customers to chat for product search, cart management, and checkout. The agent integrates with Shopify's Storefront MCP and supports various LLM providers. Its core purpose is to provide an intelligent, automated shopping assistant that streamlines the customer journey and leverages advanced AI capabilities within the Shopify ecosystem, aiming to become a leading AI solution for Shopify merchants.

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

### Technical Implementations
- **Monorepo**: Managed with pnpm workspaces.
- **Backend**: Express 5 serves as the API server.
- **Database**: PostgreSQL with Drizzle ORM.
- **LLM Integration**: Supports multiple providers (OpenAI, Anthropic, xAI, Google Gemini) with encrypted API keys (AES-256-GCM).
- **API Communication**: Type-safe client-server interaction via Orval for OpenAPI codegen.
- **Multi-Tenancy**: Secured by `store_domain` scoping, PostgreSQL Row-Level Security (RLS), and cross-tenant guard middleware.
- **Audit Logging**: Tracks all sensitive operations in a dedicated `audit_logs` table.
- **Session Management**: Customer and merchant sessions are persisted with defined TTLs.
- **Shop Knowledge**: Merchants can input structured knowledge for contextual LLM responses, supporting bulk import and markdown splitting.
- **Brand Voice & Customization**: Merchants define brand voice, custom instructions, welcome messages, and product recommendation strategies.
- **UCP Dynamic Capability Negotiation**: Full UCP 2026-01-11 specification support for dynamic capability discovery and tool generation.
- **Theme Embeds**: Various embed modes (Chat, AI Search) for native integration into Shopify themes.
- **Chat Widget**: A Shopify theme app extension provides a customizable chat widget.
- **"Shop For Me" Page**: A public-facing full-page chat interface.
- **Performance & Caching**: LRU caches for frequently accessed data and atomic JSONB append for conversation messages.
- **Security**: HMAC verification, strict body size limits, CORS, global error handling, LLM tool-call loop guard, DOMPurify for Markdown rendering, and prompt injection guards (regex, LLM classifier, system prompt hardening).
- **Prompt Injection Guard**: Layered defense system with regex, LLM classifier, and system prompt hardening, along with tool response scanning and async output auditing. Merchant controls for sensitivity and blocked topics are available.
- **Access Token Scope Validation**: OAuth callback validates Shopify access token scopes.

### Feature Specifications
- **Shopify OAuth**: Secure merchant authentication and app installation.
- **Store Management**: CRUD operations for merchant stores.
- **Knowledge Management**: CRUD for categorized shop knowledge entries.
- **Chat**: Real-time SSE streaming for AI chat interactions, persisting conversations. The chat route (`routes/chat.ts`) is a thin orchestrator that delegates to focused services: `conversation-service.ts` (load/create/persist conversations), `knowledge-cache.ts` (LRU-cached knowledge), `llm-context.ts` (message windowing + system prompt), `output-audit.ts` (async retraction), and `tool-guard.ts` (tool execution with fallback + response guarding).
- **Analytics**: Comprehensive merchant analytics dashboard with: conversation metrics, tool usage breakdown, conversion funnel (chat → cart → checkout → purchase), top recommended products, abandoned cart tracking, and estimated revenue from AI-assisted checkouts. Supports date range selection (7d, 30d, 90d, custom) with auto-refresh. Analytics events logged include `chat`, `tool_call`, `cart_created`, `checkout_started`, `checkout_completed`, and `product_recommended`. Enhanced API endpoint at `/stores/:storeDomain/analytics/enhanced` provides server-side aggregated data. CSV export endpoint at `/stores/:storeDomain/analytics/export` supports downloading analytics data as CSV files, with optional `sections` query param to export individual sections (overview, daily_chats, top_queries, tool_usage, conversion_funnel, top_products). Export events are logged with `analytics_exported` event type. Frontend provides split "Export CSV" button with dropdown for per-section export.
- **Preferences & Personalization**: User preferences (display name, units, budget, style, clothing sizes, material/brand/color preferences, lifestyle filters) are stored per session+store. Preferences are injected into the LLM system prompt for personalized responses. A regex-based preference extractor automatically detects and saves preferences mentioned in conversation (e.g., "I wear size 10"). The "What I remember" panel in the chat UI shows stored preferences with inline edit/delete controls.
- **Voice Input**: Browser-native Web Speech API integration for voice-to-text chat input with recording indicator and graceful degradation.
- **Visual Product Search**: Image upload with camera capture for AI-powered product identification. Supports OpenAI and Gemini vision models. Images are processed server-side to generate product descriptions, then fed into the existing MCP product search flow.
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
- **Shopify API**: For OAuth, store data, and platform interaction.
- **Shopify Storefront MCP**: JSON-RPC client for product search, cart management, and checkout.
- **Shopify Storefront GraphQL**: For fetching additional store data.
- **OpenAI SDK**: For OpenAI's LLMs.
- **Anthropic SDK**: For Anthropic's LLMs.
- **xAI (via OpenAI SDK)**: For xAI's models.