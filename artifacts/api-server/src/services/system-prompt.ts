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

export type UserPreferencesContext = Record<string, string>;

export interface StoreCustomization {
  brandVoice?: BrandVoice | null;
  customInstructions?: string | null;
  recommendationStrategy?: string | null;
}

export function buildSystemPrompt(
  storeDomain: string,
  knowledge: ShopKnowledge[],
  ucpDoc: UCPDiscoveryDocument | null,
  chatContext?: { productHandle?: string; collectionHandle?: string; cartToken?: string; searchMode?: boolean; customerAccountConnected?: boolean; customerAccountStoreDomain?: string },
  customization?: StoreCustomization,
  userPreferences?: UserPreferencesContext | null
): string {
  const parts: string[] = [];

  parts.push(`You are a helpful AI shopping assistant for the Shopify store "${storeDomain}".`);
  parts.push("Your goal is to help customers find products, answer questions about products, sizing, availability, policies, and provide a great shopping experience.");
  parts.push("Always be helpful, accurate, and concise. If you don't know something, say so honestly.");
  parts.push("When recommending products, use the available tools to search the store's catalog.");
  parts.push("Format product recommendations clearly with names, prices, and key details.");

  if (customization?.brandVoice) {
    const bv = customization.brandVoice;
    parts.push(`\nBrand Voice: Tone is "${bv.tone}". Personality: ${bv.personality || "helpful assistant"}.`);
    if (bv.greeting) parts.push(`Greeting style: ${bv.greeting}`);
    if (bv.signOff) parts.push(`Sign-off style: ${bv.signOff}`);
  }

  if (customization?.customInstructions) {
    parts.push(`\nStore-specific instructions: ${customization.customInstructions}`);
  }

  if (customization?.recommendationStrategy) {
    const strategyMap: Record<string, string> = {
      bestsellers_first: "Prioritize bestselling products in recommendations.",
      new_arrivals_first: "Prioritize new arrivals in recommendations.",
      price_low_to_high: "When showing multiple products, order by price from low to high.",
      personalized: "Personalize recommendations based on customer preferences and browsing context.",
    };
    const strategyHint = strategyMap[customization.recommendationStrategy];
    if (strategyHint) parts.push(`\nRecommendation strategy: ${strategyHint}`);
  }

  if (knowledge.length > 0) {
    parts.push("\n--- Store Knowledge Base ---");
    for (const k of knowledge) {
      parts.push(`[${k.category}] ${k.title}: ${k.content}`);
    }
    parts.push("--- End Knowledge Base ---");
  }

  if (ucpDoc) {
    try {
      const capabilities = extractAllCapabilities(ucpDoc);
      if (capabilities.length > 0) {
        parts.push("\n--- UCP Capabilities ---");
        for (const cap of capabilities) {
          const safeName = sanitizeUCPValue(cap.name || "unknown");
          const safeDesc = sanitizeUCPValue(cap.description || "", 200);
          parts.push(`- ${safeName}: ${safeDesc}`);
        }
        parts.push("--- End UCP Capabilities ---");
      }
    } catch {
    }
  }

  if (chatContext?.productHandle) {
    parts.push(`\nThe customer is currently viewing product: "${chatContext.productHandle}". Focus your assistance on this product unless they ask about something else.`);
  }
  if (chatContext?.collectionHandle) {
    parts.push(`\nThe customer is browsing collection: "${chatContext.collectionHandle}". Consider this context when making recommendations.`);
  }
  if (chatContext?.cartToken) {
    parts.push("\nThe customer has an active cart. You can help them with cart-related questions.");
  }
  if (chatContext?.searchMode) {
    parts.push("\nThe customer is using the search feature. Help them find what they're looking for efficiently.");
  }
  if (chatContext?.customerAccountConnected) {
    parts.push("\nThe customer has connected their account. You can access their order history and account details using the authenticated tools.");
  }

  if (userPreferences && Object.keys(userPreferences).length > 0) {
    parts.push("\n--- Customer Preferences ---");
    for (const [key, value] of Object.entries(userPreferences)) {
      parts.push(`- ${key}: ${value}`);
    }
    parts.push("--- End Preferences ---");
    parts.push("Use these preferences to personalize your recommendations and responses.");
  }

  return parts.join("\n");
}
