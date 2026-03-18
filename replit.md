# Shopify MCP AI Shopping Agent

## Overview
This project is a multi-tenant Shopify AI Shopping Agent designed to enhance e-commerce customer interactions. It allows merchants to configure an AI assistant with their store's knowledge, enabling customers to chat for product search, cart management, and checkout. The agent integrates with Shopify's Storefront MCP and supports various LLM providers. Its core purpose is to provide an intelligent, automated shopping assistant that streamlines the customer journey and leverages advanced AI capabilities within the Shopify ecosystem. The project aims to become a leading AI solution for Shopify merchants, offering a seamless and personalized shopping experience that drives sales and customer satisfaction.

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
- **LLM Integration**: Multi-provider support (OpenAI, Anthropic, xAI) with a unified interface. LLM API keys are stored securely server-side.
- **API Communication**: Orval for OpenAPI-based API codegen, ensuring type-safe client-server interaction.
- **Multi-Tenancy**: Every backend route and DB query is scoped by `store_domain` for secure multi-tenant operation.
- **Session Management**: Customer and merchant sessions are persisted in the database with defined TTLs. OAuth pending states are also stored in the DB (`pending_oauth_states` table) for horizontal scaling support.
- **Shop Knowledge**: Merchants can input structured knowledge that is dynamically injected into the LLM's system prompt for contextual responses.
- **UCP Compliance**: Full support for Universal Commerce Protocol (UCP) for standardized agentic commerce capabilities (discovery, checkout primitives, order tracking).
- **Theme Embeds**: Various embed modes (Chat, AI Search, Contextual Assistant, Product Assistant) are available for native integration into Shopify themes via script tags or iframes.
- **Chat Widget**: A Shopify theme app extension provides a customizable chat widget with merchant-controlled enable/disable toggles.
- **"Shop For Me" Page**: A public-facing full-page chat interface available at `/shop/{storeDomain}`.
- **Rate Limiting**: Implemented on chat endpoints to prevent abuse.
- **Security**: HMAC verification, strict body size limits, CORS configuration, and a global error handler. LLM tool-call loop has a configurable max-iterations guard (default 10).

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

## External Dependencies
- **Shopify API**: For OAuth, accessing store data, and interacting with the Shopify platform.
- **Shopify Storefront MCP**: JSON-RPC client for product search, cart management, and checkout operations.
- **Shopify Storefront GraphQL**: For fetching additional store data like blogs and collections.
- **OpenAI SDK**: Integration with OpenAI's large language models.
- **Anthropic SDK**: Integration with Anthropic's large language models.
- **xAI (via OpenAI SDK)**: Integration with xAI's models using the OpenAI SDK compatible interface.
- **PostgreSQL**: Relational database for persistent storage.