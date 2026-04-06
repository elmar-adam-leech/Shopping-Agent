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
  chatContext?: {
    productHandle?: string;
    collectionHandle?: string;
    cartToken?: string;
    searchMode?: boolean;
    customerAccountConnected?: boolean;
    customerAccountStoreDomain?: string;
  },
  customization?: StoreCustomization,
  userPreferences?: UserPreferencesContext | null
): string {
  const parts: string[] = [];

  parts.push(`You are the AI shopping assistant for ${storeDomain}.`);
  parts.push("Help customers find products, answer questions, and provide personalized shopping recommendations.");
  parts.push("Be helpful, accurate, and concise. Only discuss topics related to the store and its products.");

  if (customization?.brandVoice) {
    const bv = customization.brandVoice;
    parts.push(`\n## Brand Voice`);
    parts.push(`Tone: ${bv.tone}`);
    if (bv.personality) parts.push(`Personality: ${bv.personality}`);
    if (bv.greeting) parts.push(`Greeting style: ${bv.greeting}`);
    if (bv.signOff) parts.push(`Sign-off style: ${bv.signOff}`);
  }

  if (customization?.customInstructions) {
    parts.push(`\n## Custom Instructions\n${customization.customInstructions}`);
  }

  if (customization?.recommendationStrategy) {
    const strategyMap: Record<string, string> = {
      bestsellers_first: "Prioritize bestselling products in recommendations.",
      new_arrivals_first: "Prioritize new arrivals in recommendations.",
      price_low_to_high: "When showing multiple products, order by price from low to high.",
      personalized: "Personalize recommendations based on customer preferences and browsing context.",
    };
    const strategyHint = strategyMap[customization.recommendationStrategy];
    
    if (customization.recommendationStrategy !== "personalized" || strategyHint) {
       parts.push(`\n## Recommendation Strategy`);
       if (strategyHint) {
         parts.push(strategyHint);
       } else {
         parts.push(`Prefer showing products using the "${customization.recommendationStrategy}" strategy when making recommendations.`);
       }
    }
  }

  if (knowledge.length > 0) {
    parts.push("\n## Store Knowledge");
    const grouped: Record<string, ShopKnowledge[]> = {};
    for (const k of knowledge) {
      const cat = k.category || "general";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(k);
    }
    for (const [category, items] of Object.entries(grouped)) {
      parts.push(`\n### ${category}`);
      for (const item of items) {
        parts.push(`- **${item.title}**: ${item.content}`);
      }
    }
  }

  if (ucpDoc) {
    try {
      const capabilities = extractAllCapabilities(ucpDoc);
      if (capabilities.length > 0) {
        parts.push("\n## Available Capabilities");
        const toolDescriptions = generateToolsFromCapabilities(capabilities);
        for (const tool of toolDescriptions) {
          parts.push(`- ${sanitizeUCPValue(tool.name)}: ${sanitizeUCPValue(tool.description || "", 200)}`);
        }
      }
      if (ucpDoc.businessName) {
        parts.push(`Business: ${sanitizeUCPValue(ucpDoc.businessName)}`);
      }
    } catch {
    }
  }

  if (chatContext) {
    if (chatContext.productHandle) {
      parts.push(`\n## Contextual Information`);
      parts.push(`The customer is currently viewing product: "${chatContext.productHandle}". Focus your assistance on this product unless they ask about something else.`);
    }
    if (chatContext.collectionHandle) {
      if (!chatContext.productHandle) parts.push(`\n## Contextual Information`);
      parts.push(`The customer is browsing collection: "${chatContext.collectionHandle}". Consider this context when making recommendations.`);
    }
    if (chatContext.cartToken) {
      if (!chatContext.productHandle && !chatContext.collectionHandle) parts.push(`\n## Contextual Information`);
      parts.push("The customer has an active cart. You can help them with cart-related questions.");
    }
    if (chatContext.searchMode) {
      if (!chatContext.productHandle && !chatContext.collectionHandle && !chatContext.cartToken) parts.push(`\n## Contextual Information`);
      parts.push("The customer is using the search feature. Help them find what they're looking for efficiently.");
    }
    if (chatContext.customerAccountConnected) {
      if (!chatContext.productHandle && !chatContext.collectionHandle && !chatContext.cartToken && !chatContext.searchMode) parts.push(`\n## Contextual Information`);
      parts.push("The customer has connected their account. You can access their order history and account details using the authenticated tools.");
    }
  }

  if (userPreferences && Object.keys(userPreferences).length > 0) {
    parts.push("\n## Customer Preferences");
    for (const [key, value] of Object.entries(userPreferences)) {
      if (value) {
        parts.push(`- ${key}: ${value}`);
      }
    }
    parts.push("Use these preferences to personalize your recommendations, but always ask before assuming.");
  }

  return parts.join("\n");
}
