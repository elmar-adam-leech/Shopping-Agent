# Shopify MCP AI Shopping Agent

## Overview
This project is a multi-tenant Shopify AI Shopping Agent designed to enhance e-commerce customer interactions. It allows merchants to configure an AI assistant with their store's knowledge, enabling customers to chat for product search, cart management, and checkout. The agent integrates with Shopify's Storefront MCP and supports various LLM providers. Its core purpose is to provide an intelligent, automated shopping assistant that streamlines the customer journey, drives sales, and leverages advanced AI capabilities within the Shopify ecosystem to increase customer satisfaction.

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
The frontend uses React 18, Vite, Tailwind CSS, and shadcn/ui for a modern, responsive interface. It supports rich multi-modal chat rendering with components like product carousels, quick add-to-cart, comparison tables, and inline cart summaries. A `ThemeProvider` provides full dark mode support, and all interactive elements are designed for mobile responsiveness.

### Technical Implementations
The project is a monorepo managed with pnpm workspaces. The backend is an Express 5 API server, utilizing PostgreSQL with Drizzle ORM. It integrates with multiple LLM providers (OpenAI, Anthropic, xAI, Google Gemini) via a unified interface, with encrypted API keys. Type-safe client-server communication is achieved using Orval for OpenAPI codegen.

Key architectural decisions include:
- **Multi-Tenancy**: Secured by `store_domain` scoping, PostgreSQL Row-Level Security (RLS), and cross-tenant guard middleware.
- **Audit Logging**: All security-sensitive mutations are recorded in a dedicated `audit_logs` table.
- **Soft Delete Infrastructure**: All user-initiated deletions use soft delete (`deleted_at` timestamp) with a configurable retention period.
- **Graceful Shutdown**: The API server handles SIGTERM/SIGINT signals with a graceful shutdown sequence.
- **Session Management**: Customer and merchant sessions are persisted in the database with defined TTLs.
- **Shop Knowledge**: Merchants can input structured knowledge, dynamically injected into the LLM's system prompt. Supports bulk import and content hashing for changes.
- **Shopify Content Sync**: Auto-imports pages, blog articles, and store policies from Shopify via Storefront GraphQL API into the knowledge base.
- **Brand Voice & Customization**: Merchants define brand voice, custom instructions, welcome messages, and product recommendation strategies.
- **UCP Dynamic Capability Negotiation**: Full support for UCP 2026-01-11 for dynamic capability discovery and tool generation, persisting capabilities per store.
- **Theme Embeds**: Various embed modes (Chat, AI Search, Contextual Assistant, Product Assistant) for integration into Shopify themes.
- **"Shop For Me" Page**: A public-facing full-page chat interface.
- **Performance & Caching**: LRU caches are used for frequently accessed data. Conversation messages use atomic JSONB append with a 200-message cap.
- **Middleware Organization**: Centralized middleware for tenant validation, session validation, merchant auth, rate limiters, cache-control, request logging, and gzip compression.
- **Security**: Includes HMAC verification, strict body size limits, CORS, global error handling, LLM tool-call loop guard, and sanitized Markdown rendering.
- **Access Token Scope Validation**: OAuth callback validates Shopify access token scopes.
- **Prompt Injection Guard**: A regex-based defense system with system prompt hardening and tool response scanning.
- **Data Retention**: Configurable data retention periods per store via store settings.
- **Customer Account MCP**: OAuth 2.0 + PKCE flow for connecting shoppers to their Shopify customer accounts for post-purchase and order management features.
- **Webhooks Integration**: Real-time sync via Shopify webhooks for product, inventory, and order updates with HMAC-SHA256 signature verification.

### Feature Specifications
- **Shopify OAuth**: Secure merchant authentication and app installation.
- **Store Management**: CRUD operations for merchant stores.
- **Knowledge Management**: CRUD for categorized shop knowledge entries.
- **Chat**: Real-time SSE streaming for AI chat interactions, persisting conversations.
- **Analytics Logging**: Legacy internal analytics event logging (no longer actively used in public-facing features).
- **Preferences & Personalization**: User preferences are stored per session+store and injected into the LLM system prompt. Includes a preference extractor and UI for managing preferences.
- **Rich Blog & Metaobject Rendering**: Enhanced display of Shopify blog articles and metaobjects.
- **Multi-Turn Cart Editing**: Conversational cart modifications with preview and undo support.
- **Visual Product Search**: Image upload for AI-powered product identification using vision models.
- **LLM Provider System**: Decoupled LLM provider implementations with a factory for dynamic selection.
- **Universal Commerce Protocol (UCP)**: Dynamic capability negotiation, DB persistence, dynamic tool generation from advertised capabilities (checkout, orders, subscriptions, loyalty, discounts, preorders, wishlists, gifting), LLM context injection, and graceful non-UCP fallback.
- **Theme Integration**: Script-tag and iframe-based embedding options for AI assistant functionalities.
- **Customer Account MCP**: OAuth 2.0 + PKCE flow for connecting shoppers to their Shopify customer accounts.
- **Feedback Loop**: Thumbs up/down feedback buttons on AI assistant messages with optional comments.
- **Post-Purchase & Order Management**: Full order lifecycle support via UCP/MCP tools, including getting orders, order status, and initiating return requests.

## External Dependencies
- **Shopify API**: For OAuth, store data, and platform interaction.
- **Shopify Storefront MCP**: For product search, cart management, and checkout.
- **Shopify Storefront GraphQL**: For additional store data (blogs, collections).
- **OpenAI SDK**: For OpenAI's large language models.
- **Anthropic SDK**: For Anthropic's large language models.
- **xAI (via OpenAI SDK)**: For xAI's models using an OpenAI SDK compatible interface.