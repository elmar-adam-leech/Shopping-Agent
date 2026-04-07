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
The frontend is built with React 18, Vite, Tailwind CSS, and shadcn/ui, providing a modern and responsive user interface with full dark mode support. Key UI components include rich multi-modal chat rendering for products, carts, and collections. The design prioritizes clarity, ease of use, and mobile responsiveness, incorporating components like chat interfaces, settings panels, and analytics dashboards. Embed modes are designed for seamless integration into existing Shopify themes.

### Technical Implementations
The project is structured as a monorepo using pnpm workspaces. The backend is an Express 5 API server, utilizing PostgreSQL with Drizzle ORM for data persistence. It supports multiple LLM providers (OpenAI, Anthropic, xAI, Google Gemini) via a unified, encrypted interface.

Core architectural patterns include:
- **Multi-Tenancy**: Secured by `store_domain` scoping, PostgreSQL Row-Level Security (RLS), and cross-tenant guard middleware, ensuring data isolation and security.
- **Audit Logging**: Comprehensive logging of security-sensitive mutations.
- **Soft Delete Infrastructure**: All user-initiated deletions are soft deletes, with configurable retention periods.
- **Graceful Shutdown**: The API server includes a graceful shutdown sequence for reliability.
- **Session Management**: Customer and merchant sessions are persisted in the database with defined TTLs.
- **Shop Knowledge**: Merchants can input structured knowledge for contextual LLM responses, supporting bulk import.
- **Brand Voice & Customization**: Merchants define brand voice, custom instructions, welcome messages, and product recommendation strategies.
- **UCP Dynamic Capability Negotiation**: Full support for Universal Commerce Protocol (UCP) 2026-01-11 specification for dynamic capability discovery and tool generation, with graceful fallback for non-UCP stores.
- **Theme Embeds**: Various embed modes (Chat, AI Search, Contextual Assistant, Product Assistant) for native integration into Shopify themes.
- **Performance & Caching**: Utilizes LRU caches for frequently accessed data and atomic JSONB appends for conversation messages.
- **Security**: Includes HMAC verification, strict body size limits, CORS, global error handling, LLM tool-call loop guard, DOMPurify for markdown sanitization, and access token scope validation.
- **Prompt Injection Guard**: A layered defense system combining regex, LLM classification, and system prompt hardening.
- **Privacy & Data Management**: Full consent management system with GDPR/CCPA compliance, data export/deletion, and configurable retention periods.
- **Customer Account MCP**: OAuth 2.0 + PKCE flow for connecting shoppers to their Shopify customer accounts, enabling post-purchase and order management features.

### Feature Specifications
- **Shopify OAuth**: Secure merchant authentication.
- **Store & Knowledge Management**: CRUD operations for merchant stores and categorized knowledge entries.
- **Chat**: Real-time SSE streaming for AI chat interactions with conversation persistence.
- **Analytics**: Comprehensive merchant dashboard with conversation metrics, tool usage, conversion funnels, and product recommendations, including CSV export.
- **Preferences & Personalization**: Per-session user preferences are stored and injected into the LLM for personalized responses, with automatic extraction from conversations.
- **A/B Prompt Testing**: Merchants can conduct A/B tests for AI responses.
- **Voice Input**: Browser-native Web Speech API integration.
- **Visual Product Search**: Image upload with camera capture for AI-powered product identification using OpenAI and Gemini vision models.
- **LLM Provider System**: Decoupled LLM provider implementations with a factory for dynamic selection.
- **Abandoned Checkout Recovery**: Proactive in-chat recovery for incomplete checkouts based on configurable merchant settings.
- **Post-Purchase & Order Management**: Full order lifecycle support via UCP/MCP tools including order listing, status tracking, and return requests.
- **Multi-Turn Cart Editing**: Conversational cart modifications (swap items, change variants, remove items) with visual before/after preview cards. The `propose_cart_edit` virtual tool shows a CartEditPreviewCard with confirm/cancel actions and single-step undo support. Analytics logged for all cart edit proposals.

## External Dependencies
- **Shopify API**: For OAuth, store data, and platform interaction.
- **Shopify Storefront MCP**: For product search, cart management, and checkout.
- **Shopify Storefront GraphQL**: For additional store data (blogs, collections).
- **OpenAI SDK**: For OpenAI's large language models.
- **Anthropic SDK**: For Anthropic's large language models.
- **xAI (via OpenAI SDK)**: For xAI's models using an OpenAI SDK compatible interface.