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

### Feature Specifications
- **Shopify OAuth**: Secure merchant authentication and app installation.
- **Store and Knowledge Management**: CRUD operations for merchant stores and categorized knowledge entries.
- **Chat**: Real-time SSE streaming for AI chat interactions with conversation persistence.
- **Analytics**: Comprehensive merchant analytics dashboard covering conversation metrics, tool usage, conversion funnel, and product recommendations, with CSV export.
- **Preferences & Personalization**: User preferences are stored per session+store, injected into the LLM prompt, and automatically extracted from conversations.
- **A/B Prompt Testing**: Merchants can test prompt variants and analyze performance.
- **Voice Input**: Browser-native Web Speech API integration for voice-to-text.
- **Visual Product Search**: Image upload with camera capture for AI-powered product identification using vision models.
- **LLM Provider System**: Decoupled, factory-based LLM provider selection.
- **Feedback Loop**: Thumbs up/down feedback buttons on AI assistant messages. Feedback is recorded as `feedback_positive`/`feedback_negative` events in analytics_logs. Optional comment input on downvote. Merchant analytics dashboard includes a "Response Quality" section with satisfaction rate, daily satisfaction chart, most-downvoted patterns, and filterable negative feedback log.
- **Abandoned Checkout Recovery**: Proactive in-chat recovery for incomplete checkouts based on configurable delays.
- **Post-Purchase & Order Management**: Full order lifecycle support via UCP/MCP tools for order status, history, and return requests.

## External Dependencies
- **Shopify API**: For OAuth, store data, and platform interaction.
- **Shopify Storefront MCP**: For product search, cart management, and checkout.
- **Shopify Storefront GraphQL**: For additional store data (blogs, collections).
- **OpenAI SDK**: For OpenAI's large language models.
- **Anthropic SDK**: For Anthropic's large language models.
- **xAI (via OpenAI SDK)**: For xAI's models using an OpenAI SDK compatible interface.