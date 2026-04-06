import type { ShopKnowledge } from "@workspace/db";
import type { BrandVoice } from "@workspace/db/schema";
import type { UCPDiscoveryDocument } from "./ucp-client";
import { extractAllCapabilities, generateToolsFromCapabilities } from "./ucp-client";

const UCP_SAFE_PATTERN = /^[a-zA-Z0-9._\-: ]{1,100}$/;

function sanitizeUCPValue(value: string, maxLen = 100): string {
  const trimmed = value.slice(0, maxLen).replace(/[\r\n\t]/g, " ").trim();
  if (UCP_SAFE_PATTERN.test(trimmed)) return trimmed;
  return trimmed.replace(/[^a-zA-Z0-9._\-: ]/g, "");
}
import { SYSTEM_PROMPT_HARDENING } from "./prompt-guard";

const CATEGORY_LABELS: Record<string, string> = {
  general: "General Store Information",
  sizing: "Sizing & Recommendations",
  compatibility: "Compatibility Rules",
  required_accessories: "Required Accessories",
  restrictions: "Restrictions & Limitations",
  policies: "Policies (Returns, Shipping, Warranty)",
  custom: "Additional Information",
};

const RECOMMENDATION_STRATEGY_LABELS: Record<string, string> = {
  bestsellers_first: "Prioritize best-selling products when making recommendations",
  new_arrivals_first: "Prioritize newest arrivals when making recommendations",
  price_low_to_high: "Prioritize lower-priced options first when making recommendations",
  personalized: "Personalize recommendations based on the customer's expressed preferences and browsing context",
};

export interface ChatContext {
  productHandle?: string;
  collectionHandle?: string;
  cartToken?: string;
  searchMode?: boolean;
  customerAccountConnected?: boolean;
  customerAccountStoreDomain?: string;
}

export interface StoreCustomization {
  brandVoice?: BrandVoice | null;
  customInstructions?: string | null;
  recommendationStrategy?: string;
}

export function buildSystemPrompt(
  storeDomain: string,
  knowledge: ShopKnowledge[],
  ucpDoc?: UCPDiscoveryDocument | null,
  context?: ChatContext,
  customization?: StoreCustomization
): string {
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

  if (customization?.brandVoice) {
    const bv = customization.brandVoice;
    prompt += `\n\n## Brand Voice & Persona`;
    prompt += `\nAdopt the following brand voice in all your responses:`;
    prompt += `\n- **Tone**: ${bv.tone}`;
    if (bv.personality) {
      prompt += `\n- **Personality**: ${bv.personality}`;
    }
    if (bv.greeting) {
      prompt += `\n- **Greeting style**: When greeting customers, use a style similar to: "${bv.greeting}"`;
    }
    if (bv.signOff) {
      prompt += `\n- **Sign-off style**: When ending conversations, use a style similar to: "${bv.signOff}"`;
    }
  }

  if (customization?.customInstructions) {
    prompt += `\n\n## Custom Instructions from Store Owner\nThe store owner has provided the following special instructions that you must follow:\n${customization.customInstructions}`;
  }

  if (customization?.recommendationStrategy) {
    const strategyLabel = RECOMMENDATION_STRATEGY_LABELS[customization.recommendationStrategy];
    if (strategyLabel) {
      prompt += `\n\n## Product Recommendation Strategy\n${strategyLabel}.`;
    }
  }

  if (ucpDoc) {
    const allCaps = extractAllCapabilities(ucpDoc);
    const dynamicTools = generateToolsFromCapabilities(ucpDoc);

    const sanitizedVersion = sanitizeUCPValue(ucpDoc.version ?? "unknown", 20);
    prompt += `\n\n## UCP (Universal Commerce Protocol) Capabilities
This store supports UCP version ${sanitizedVersion}. The following capabilities have been negotiated dynamically with this store:`;

    if (allCaps.length > 0) {
      const sanitizedCaps = allCaps.map(c => sanitizeUCPValue(c));
      prompt += `\n\n**Available capabilities:** ${sanitizedCaps.join(", ")}`;
    }

    if (dynamicTools.length > 0) {
      prompt += `\n\n**UCP tools available for this store:**`;
      for (const tool of dynamicTools) {
        prompt += `\n- **${tool.name}**: ${tool.description}`;
      }
    }

    prompt += `\n\nUse these UCP tools for all applicable commerce operations. They provide a standardized commerce flow. Only offer capabilities that are listed above — do not suggest features this store hasn't advertised.`;

    if (ucpDoc.services && ucpDoc.services.length > 0) {
      prompt += `\n\nDiscovered UCP services:`;
      for (const service of ucpDoc.services) {
        const svcType = sanitizeUCPValue(service.type);
        const caps = service.capabilities
          ? service.capabilities.map(c => sanitizeUCPValue(c)).join(", ")
          : "";
        prompt += `\n- ${svcType}${caps ? ` (capabilities: ${caps})` : ""}`;
      }
    }

    if (ucpDoc.payment_handlers && ucpDoc.payment_handlers.length > 0) {
      prompt += `\n\nSupported payment methods:`;
      for (const handler of ucpDoc.payment_handlers) {
        const hType = sanitizeUCPValue(handler.type);
        const methods = handler.supported_methods
          ? handler.supported_methods.map(m => sanitizeUCPValue(m)).join(", ")
          : "";
        prompt += `\n- ${hType}${methods ? `: ${methods}` : ""}`;
      }
    }
  }

  if (context) {
    prompt += `\n\n## Current Customer Context`;
    if (context.customerAccountConnected && context.customerAccountStoreDomain) {
      prompt += `\nYou are connected to the customer's account for ${context.customerAccountStoreDomain} and can access order history, account details, and other customer-specific information. Use the authenticated MCP tools to provide personalized assistance.`;
    } else if (context.customerAccountConnected === false) {
      prompt += `\nThe customer's account is not connected. If the customer asks about order history, account details, returns, or other personalized information, you MUST tell them: "To access your order history and account details, please connect your customer account using the 'Connect Account' button in the chat header." Do NOT attempt to look up orders or account information without a connected account — inform the customer they need to connect first.`;
    }
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

    const grouped = knowledge.reduce<Record<string, ShopKnowledge[]>>((acc, entry) => {
      (acc[entry.category] ??= []).push(entry);
      return acc;
    }, {});

    for (const [category, entries] of Object.entries(grouped)) {
      const label = CATEGORY_LABELS[category] || category;
      prompt += `\n### ${label}\n`;
      for (const entry of [...entries].sort((a, b) => a.sortOrder - b.sortOrder)) {
        prompt += `\n**${entry.title}**\n${entry.content}\n`;
      }
    }
  }

  prompt += SYSTEM_PROMPT_HARDENING;

  return prompt;
}
