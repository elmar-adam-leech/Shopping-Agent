# Shopify MCP AI Shopping Agent

## Overview
This project is a multi-tenant Shopify AI Shopping Agent designed to enhance e-commerce customer interactions. It allows merchants to configure an AI assistant with their store's knowledge, enabling customers to chat for product search, cart management, and checkout. The agent integrates with Shopify's Storefront MCP, supports various LLM providers, and enables A/B prompt testing with configurable variants and analytics. Its core purpose is to provide an intelligent, automated shopping assistant that streamlines the customer journey, drives sales, and leverages advanced AI capabilities within the Shopify ecosystem to increase customer satisfaction.

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
The frontend uses React 18, Vite, Tailwind CSS, and shadcn/ui for a modern, responsive interface. It supports rich multi-modal chat rendering with components like product carousels, quick add-to-cart, comparison tables, and inline cart summaries. A `ThemeProvider` provides full dark mode support, and all interactive elements are designed for mobile responsiveness, including a bottom navigation bar for merchant dashboards on smaller viewports.

### Technical Implementations
The project is a monorepo managed with pnpm workspaces. The backend is an Express 5 API server, utilizing PostgreSQL with Drizzle ORM. It integrates with multiple LLM providers (OpenAI, Anthropic, xAI, Google Gemini) via a unified interface, with encrypted API keys. Type-safe client-server communication is achieved using Orval for OpenAPI codegen.

Key architectural decisions include:
- **Multi-Tenancy**: Secured by `store_domain` scoping, PostgreSQL Row-Level Security (RLS) with `FORCE ROW LEVEL SECURITY`, and cross-tenant guard middleware.
- **Audit Logging**: All security-sensitive mutations are recorded in a dedicated `audit_logs` table.
- **Soft Delete Infrastructure**: User-initiated deletions use soft delete (`deleted_at` timestamp) with a configurable retention period.
- **Graceful Shutdown**: The API server includes a graceful shutdown sequence for SIGTERM/SIGINT signals.
- **Shop Knowledge**: Merchants can input structured knowledge, dynamically injected into the LLM's system prompt.
- **Brand Voice & Customization**: Merchants define brand voice, custom instructions, welcome messages, and product recommendation strategies.
- **UCP Dynamic Capability Negotiation**: Full support for UCP 2026-01-11 for dynamic capability discovery and tool generation, persisting capabilities per store.
- **Theme Embeds**: Various embed modes (Chat, AI Search, Contextual Assistant, Product Assistant) for integration into Shopify themes.
- **Performance & Caching**: LRU caches are used for frequently accessed data, and conversation messages use atomic JSONB append with truncation.
- **Security**: Includes HMAC verification, strict body size limits, CORS, global error handling, and an LLM tool-call loop guard. Markdown rendering is sanitized with DOMPurify.
- **Prompt Injection Guard**: A layered defense system combining regex, an LLM classifier, system prompt hardening, and tool response scanning.
- **Privacy & Data Management**: Comprehensive consent management system for GDPR/CCPA compliance, data export/deletion, and configurable retention periods.
- **Customer Account MCP**: OAuth 2.0 + PKCE flow for connecting shoppers to their Shopify customer accounts for post-purchase and order management features.
- **Webhooks Integration**: Real-time sync via Shopify webhooks for product, inventory, and order updates. Webhook receiver at `POST /api/webhooks/shopify` with HMAC-SHA256 signature verification, in-memory idempotency deduplication, and store-domain scoping. Supports topics: `products/create`, `products/update`, `products/delete`, `inventory_levels/update`, `orders/updated`, `app/uninstalled`. Product webhooks invalidate caches, inventory webhooks update an in-memory availability index, order webhooks push real-time status to active SSE sessions, and app uninstall triggers soft-delete cleanup. Webhook registration is automatic during OAuth onboarding. DB tables: `webhook_registrations` (unique per store+topic, tracks health via `last_delivery_at` and `failure_count`) and `webhook_delivery_logs` (with PII redaction). Merchant dashboard includes a Webhooks settings section with registered topics, delivery log, and re-register button.

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
- **Multi-Language Support**: Automatic language detection from customer messages using regex heuristics for 16+ languages. Detected locale is stored per session (`detected_language` column in sessions table). Merchants can configure supported languages and default language in store settings. The system prompt instructs the LLM to respond consistently in the detected language. Frontend chat UI static labels (placeholder, cart, buttons) adapt to the detected locale via an i18n context/provider with translations for 8 core languages (EN, ES, FR, DE, PT, JA, KO, ZH). A `detected_language` SSE event is emitted on each chat response to update the frontend locale. CJK disambiguation uses Hiragana/Katakana (Japanese), Hangul (Korean), and Han-only (Chinese) script detection. Files: `language-detection.ts`, `i18n.ts`, `i18n-context.tsx`, `LanguageSettings.tsx`.
- **Feedback Loop**: Thumbs up/down feedback buttons on AI assistant messages. Feedback is recorded as `feedback_positive`/`feedback_negative` events in analytics_logs. Optional comment input on downvote. Merchant analytics dashboard includes a "Response Quality" section with satisfaction rate, daily satisfaction chart, most-downvoted patterns, and filterable negative feedback log.
- **Abandoned Checkout Recovery**: Proactive in-chat recovery for incomplete checkouts. Detects abandoned carts via analytics events (`cart_created`, `add_to_cart`, `checkout_started` without `checkout_completed`). Shows a `CheckoutRecoveryCard` with item summary when returning shoppers have an abandoned checkout older than the configurable delay. Shoppers can resume checkout, dismiss, or start fresh. Merchant settings include `checkout_recovery_enabled` (boolean) and `checkout_recovery_delay_minutes` (integer, 1-10080). Recovery events (`checkout_recovery_prompted`, `checkout_recovery_resumed`, `checkout_recovery_dismissed`, `checkout_recovery_converted`) are tracked in analytics. Checkout URL validation ensures only trusted Shopify domains are used. Service: `checkout-recovery-service.ts`, Route: `checkout-recovery.ts`.
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
