# Shopify Theme Extension — AI Chat Widget

A Shopify theme app extension that embeds an AI-powered chat widget on merchants' storefronts. Customers can interact with the AI shopping assistant directly on the store without leaving the page.

## Structure

```
extensions/chat-widget/
├── shopify.extension.toml    # Shopify extension config
├── blocks/
│   └── chat-widget.liquid    # Theme app extension block (Liquid + schema)
├── assets/
│   ├── chat-widget.css       # Widget styles
│   └── chat-widget.js        # Self-contained vanilla JS chat widget
├── preview.html              # Standalone preview/demo page
└── README.md
```

## Features

- Floating chat bubble (bottom-right or bottom-left)
- Opens into a full chat panel with streaming AI responses
- Renders tool call badges (e.g., "Searching products", "Browsing collections")
- Displays product cards from tool results (images, titles, prices)
- Basic markdown rendering (bold, italic, code, links, lists)
- Session persistence via localStorage (24h TTL)
- Conversation continuity across page navigations
- Mobile-responsive design
- Configurable via Shopify theme editor:
  - Widget position
  - Primary color
  - Welcome message
  - Bubble icon style
  - Widget title

## Installation (Shopify)

1. Ensure your Shopify app is set up with the Shopify CLI
2. The extension is auto-detected from `extensions/chat-widget/`
3. Run `shopify app dev` to test locally with a dev store
4. In the Shopify theme editor, add the "AI Chat Widget" app block
5. Configure the **API Endpoint URL** to point to your API server (e.g., `https://your-app.replit.app/api`)
6. Customize colors, position, and welcome message

## Preview Mode (Without Shopify)

Open `preview.html` in a browser to test the widget without a Shopify store:

1. Start the API server locally
2. Edit `preview.html` and set:
   - `data-api-endpoint` to your API server URL (e.g., `http://localhost:3001/api`)
   - `data-store-domain` to a registered store domain
3. Open `preview.html` in a browser

## API Endpoints Used

The widget communicates with two API endpoints:

- `POST {apiEndpoint}/sessions` — Creates a customer session
  - Body: `{ "storeDomain": "..." }`
  - Returns: `{ "sessionId": "...", "storeDomain": "...", "createdAt": "..." }`

- `POST {apiEndpoint}/stores/{storeDomain}/chat` — Sends a chat message (SSE stream)
  - Headers: `x-session-id: {sessionId}`
  - Body: `{ "sessionId": "...", "conversationId": ..., "message": "..." }`
  - Returns SSE events: `text`, `conversation_id`, `tool_call`, `tool_result`

## CORS

The API server must allow cross-origin requests from the Shopify storefront domain. Ensure CORS headers are configured for the merchant's storefront URL.
