import type { MCPTool } from "./mcp-client";
import { getWishlist, addToWishlist, removeFromWishlist } from "./wishlist-service";
import { getRecommendations, getCrossSellProducts } from "./recommendation-service";
import type { UserPreferencesContext } from "./system-prompt";
import type { WishlistItem } from "@workspace/db/schema";

export const INTERNAL_TOOL_NAMES = new Set([
  "recommend_products",
  "get_cross_sell_products",
  "save_to_wishlist",
  "get_wishlist",
  "remove_from_wishlist",
]);

export function getInternalToolDefinitions(): MCPTool[] {
  return [
    {
      name: "recommend_products",
      description: "Get personalized product recommendations based on the customer's stored preferences (size, style, budget, materials, colors). Use this proactively when the customer asks for recommendations or when you want to suggest products they might like.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Optional search query to refine recommendations. If not provided, recommendations are based entirely on stored preferences.",
          },
        },
      },
    },
    {
      name: "get_cross_sell_products",
      description: "Get complementary product suggestions related to a specific product. Use this after a customer adds an item to cart, to suggest 'frequently bought together' or 'you might also like' products.",
      inputSchema: {
        type: "object",
        properties: {
          productHandle: {
            type: "string",
            description: "The handle/slug of the product to find related items for",
          },
        },
        required: ["productHandle"],
      },
    },
    {
      name: "save_to_wishlist",
      description: "Save a product to the customer's wishlist for later. Use when the customer says things like 'save this for later', 'add to wishlist', 'bookmark this', or 'I'll think about it'.",
      inputSchema: {
        type: "object",
        properties: {
          productId: { type: "string", description: "The product ID or variant ID" },
          variantId: { type: "string", description: "Optional variant ID" },
          title: { type: "string", description: "Product title" },
          handle: { type: "string", description: "Product handle/slug" },
          imageUrl: { type: "string", description: "Product image URL" },
          price: { type: "string", description: "Product price amount" },
          currencyCode: { type: "string", description: "Currency code (e.g. USD)" },
        },
        required: ["productId", "title"],
      },
    },
    {
      name: "get_wishlist",
      description: "Retrieve the customer's saved wishlist items. Use when the customer asks to 'show my wishlist', 'show saved items', 'what did I save', or similar requests.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "remove_from_wishlist",
      description: "Remove an item from the customer's wishlist. Use when the customer wants to remove a saved item.",
      inputSchema: {
        type: "object",
        properties: {
          productId: { type: "string", description: "The product ID or handle to remove" },
        },
        required: ["productId"],
      },
    },
  ];
}

export interface InternalToolContext {
  storeDomain: string;
  storefrontToken: string;
  sessionId: string;
  ucpEnabled: boolean;
  userPreferences: UserPreferencesContext | null;
}

export async function executeInternalTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: InternalToolContext
): Promise<string> {
  switch (toolName) {
    case "recommend_products": {
      const prefs = ctx.userPreferences || {};
      const query = typeof args.query === "string" ? args.query : undefined;
      return getRecommendations(
        ctx.storeDomain,
        ctx.storefrontToken,
        prefs,
        ctx.ucpEnabled,
        query
      );
    }

    case "get_cross_sell_products": {
      const handle = typeof args.productHandle === "string" ? args.productHandle : "";
      return getCrossSellProducts(
        ctx.storeDomain,
        ctx.storefrontToken,
        handle,
        ctx.ucpEnabled
      );
    }

    case "save_to_wishlist": {
      const item: WishlistItem = {
        productId: String(args.productId || ""),
        variantId: args.variantId ? String(args.variantId) : undefined,
        title: String(args.title || "Unknown product"),
        handle: args.handle ? String(args.handle) : undefined,
        imageUrl: args.imageUrl ? String(args.imageUrl) : undefined,
        price: args.price ? String(args.price) : undefined,
        currencyCode: args.currencyCode ? String(args.currencyCode) : undefined,
        addedAt: new Date().toISOString(),
      };

      const result = await addToWishlist(ctx.storeDomain, ctx.sessionId, item);

      return JSON.stringify({
        success: result.added,
        message: result.added
          ? `"${item.title}" has been saved to your wishlist.`
          : `"${item.title}" is already in your wishlist.`,
        savedItem: result.added ? item : undefined,
        items: result.items,
        _action: "saved",
      });
    }

    case "get_wishlist": {
      const items = await getWishlist(ctx.storeDomain, ctx.sessionId);
      return JSON.stringify({
        items,
        count: items.length,
        message: items.length > 0
          ? `You have ${items.length} item${items.length !== 1 ? "s" : ""} in your wishlist.`
          : "Your wishlist is empty.",
        _action: "list",
      });
    }

    case "remove_from_wishlist": {
      const productId = String(args.productId || "");
      const result = await removeFromWishlist(ctx.storeDomain, ctx.sessionId, productId);

      return JSON.stringify({
        success: result.removed,
        message: result.removed
          ? `"${result.removedTitle}" has been removed from your wishlist.`
          : "Item not found in your wishlist.",
        removedTitle: result.removedTitle,
        items: result.items,
        _action: "removed",
      });
    }

    default:
      return JSON.stringify({ error: `Unknown internal tool: ${toolName}` });
  }
}
