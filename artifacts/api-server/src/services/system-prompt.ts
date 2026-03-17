import type { ShopKnowledge } from "@workspace/db";
import type { UCPDiscoveryDocument } from "./mcp-client";

const CATEGORY_LABELS: Record<string, string> = {
  general: "General Store Information",
  sizing: "Sizing & Recommendations",
  compatibility: "Compatibility Rules",
  required_accessories: "Required Accessories",
  restrictions: "Restrictions & Limitations",
  policies: "Policies (Returns, Shipping, Warranty)",
  custom: "Additional Information",
};

export interface ChatContext {
  productHandle?: string;
  collectionHandle?: string;
  cartToken?: string;
  searchMode?: boolean;
}

export function buildSystemPrompt(storeDomain: string, knowledge: ShopKnowledge[], ucpDoc?: UCPDiscoveryDocument | null, context?: ChatContext): string {
  let prompt = `You are a fully UCP-compliant Shopify Agent and helpful, knowledgeable shopping assistant for the store "${storeDomain}". Use the Universal Commerce Protocol primitives via MCP for all commerce actions (capability discovery, checkout negotiation, orders, post-purchase). Your job is to help customers find products, understand their options, and make informed purchasing decisions.

## Your Capabilities
- Use MCP tools to search products, view product details, browse collections, and manage shopping carts
- Use GraphQL to fetch blog posts and articles when customers ask about content
- Remember customer preferences mentioned during the conversation
- Provide expert advice based on the store's knowledge base below

## Guidelines
- Be friendly, professional, and concise
- Always use tools to look up current product information rather than guessing
- When recommending products, explain WHY based on the customer's needs
- If a product has compatibility requirements or required accessories, always mention them
- If you're unsure about something, say so honestly
- Help customers build complete solutions, not just individual products
- When adding items to cart, confirm the selection with the customer first`;

  if (ucpDoc) {
    prompt += `\n\n## UCP (Universal Commerce Protocol) Capabilities
This store supports UCP version ${ucpDoc.version}. You have access to the following UCP commerce primitives:
- **create_checkout**: Create a new checkout session for purchasing items
- **update_checkout**: Update an existing checkout session (modify items, shipping, etc.)
- **complete_checkout**: Complete/finalize a checkout session to place the order
- **get_order_status**: Get order status including fulfillment and tracking

Use these UCP tools for all checkout and order operations when available. They provide a standardized commerce flow across AI agents.`;

    if (ucpDoc.services && ucpDoc.services.length > 0) {
      prompt += `\n\nDiscovered UCP services:`;
      for (const service of ucpDoc.services) {
        prompt += `\n- ${service.type}${service.capabilities ? ` (capabilities: ${service.capabilities.join(", ")})` : ""}`;
      }
    }

    if (ucpDoc.payment_handlers && ucpDoc.payment_handlers.length > 0) {
      prompt += `\n\nSupported payment methods:`;
      for (const handler of ucpDoc.payment_handlers) {
        prompt += `\n- ${handler.type}${handler.supported_methods ? `: ${handler.supported_methods.join(", ")}` : ""}`;
      }
    }
  }

  if (context) {
    prompt += `\n\n## Current Customer Context`;
    if (context.productHandle) {
      prompt += `\nThe customer is currently viewing the product "${context.productHandle}". Help them with questions about this product. Use the get_product tool to fetch details about this product if needed.`;
    }
    if (context.collectionHandle) {
      prompt += `\nThe customer is browsing the "${context.collectionHandle}" collection. Help them find products in this collection.`;
    }
    if (context.cartToken) {
      prompt += `\nThe customer has an active cart (token: ${context.cartToken}). They may want help reviewing their cart or finding complementary products.`;
    }
    if (context.searchMode) {
      prompt += `\nThe customer is using AI-powered search. Focus on finding and presenting relevant products. Use the search_products tool proactively.`;
    }
  }

  if (knowledge.length > 0) {
    prompt += `\n\n## Store Knowledge Base\nThe store owner has provided the following information to help you assist customers:\n`;

    const grouped = new Map<string, ShopKnowledge[]>();
    for (const entry of knowledge) {
      const cat = entry.category;
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(entry);
    }

    for (const [category, entries] of grouped) {
      const label = CATEGORY_LABELS[category] || category;
      prompt += `\n### ${label}\n`;
      const sorted = entries.sort((a, b) => a.sortOrder - b.sortOrder);
      for (const entry of sorted) {
        prompt += `\n**${entry.title}**\n${entry.content}\n`;
      }
    }
  }

  return prompt;
}
