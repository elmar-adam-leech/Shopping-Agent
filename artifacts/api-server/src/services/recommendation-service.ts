import type { UserPreferencesContext } from "./system-prompt";
import { executeToolWithFallback } from "./tool-guard";

export interface RecommendationFilters {
  size?: string;
  colors?: string;
  materials?: string;
  budget?: string;
  style?: string;
  brands?: string;
  lifestyle?: string;
}

function buildSearchQuery(prefs: UserPreferencesContext): string {
  const parts: string[] = [];

  if (prefs.colors) parts.push(prefs.colors.split(",").map(c => c.trim()).join(" "));
  if (prefs.materials) parts.push(prefs.materials.split(",").map(m => m.trim()).join(" "));
  if (prefs.style) parts.push(prefs.style);
  if (prefs.brands) parts.push(prefs.brands.split(",").map(b => b.trim()).join(" "));
  if (prefs.lifestyle) parts.push(prefs.lifestyle);

  return parts.join(" ").trim() || "popular products";
}

function filterByBudget(products: unknown[], budgetStr?: string): unknown[] {
  if (!budgetStr) return products;

  const budgetMatch = budgetStr.match(/(\d+)\s*-\s*\$?(\d+)/);
  const maxBudget = budgetMatch ? parseInt(budgetMatch[2], 10) : parseInt(budgetStr, 10);
  if (isNaN(maxBudget)) return products;

  return products.filter((p: unknown) => {
    const product = p as Record<string, unknown>;
    const priceRange = product.priceRange as Record<string, unknown> | undefined;
    const minPrice = priceRange?.minVariantPrice as Record<string, unknown> | undefined;
    const amount = minPrice?.amount;
    if (!amount) return true;
    return parseFloat(String(amount)) <= maxBudget;
  });
}

export async function getRecommendations(
  storeDomain: string,
  storefrontToken: string,
  preferences: UserPreferencesContext,
  ucpEnabled: boolean,
  explicitQuery?: string
): Promise<string> {
  const query = explicitQuery || buildSearchQuery(preferences);

  try {
    const result = await executeToolWithFallback(
      storeDomain,
      storefrontToken,
      "search_products",
      { query, limit: 10 },
      ucpEnabled
    );

    let parsed: unknown;
    try { parsed = JSON.parse(result); } catch { return result; }

    if (parsed && typeof parsed === "object") {
      const data = parsed as Record<string, unknown>;
      const products = data.products as Record<string, unknown> | undefined;
      if (products?.edges && Array.isArray(products.edges)) {
        let filteredEdges = products.edges as unknown[];
        filteredEdges = filterByBudget(
          filteredEdges.map((e: unknown) => (e as Record<string, unknown>).node),
          preferences.budget
        ).map(node => ({ node }));

        return JSON.stringify({
          ...data,
          products: { ...products, edges: filteredEdges },
          _source: "recommendation",
          _preferences: Object.keys(preferences),
        });
      }
    }

    return result;
  } catch (err) {
    console.error("[recommendation-service] Failed to get recommendations:", err instanceof Error ? err.message : err);
    return JSON.stringify({ error: "Failed to fetch recommendations" });
  }
}

export async function getCrossSellProducts(
  storeDomain: string,
  storefrontToken: string,
  productHandle: string,
  ucpEnabled: boolean
): Promise<string> {
  try {
    const productResult = await executeToolWithFallback(
      storeDomain,
      storefrontToken,
      "get_product",
      { handle: productHandle },
      ucpEnabled
    );

    let parsed: unknown;
    try { parsed = JSON.parse(productResult); } catch { return JSON.stringify({ products: { edges: [] } }); }

    if (!parsed || typeof parsed !== "object") {
      return JSON.stringify({ products: { edges: [] } });
    }

    const product = (parsed as Record<string, unknown>).product as Record<string, unknown> | undefined;
    const productType = product?.productType as string | undefined;
    const tags = product?.tags as string[] | undefined;
    const vendor = product?.vendor as string | undefined;

    const searchTerms: string[] = [];
    if (productType) searchTerms.push(productType);
    if (vendor) searchTerms.push(vendor);
    if (tags && tags.length > 0) searchTerms.push(tags.slice(0, 2).join(" "));

    const query = searchTerms.join(" ").trim() || "popular";

    const searchResult = await executeToolWithFallback(
      storeDomain,
      storefrontToken,
      "search_products",
      { query, limit: 6 },
      ucpEnabled
    );

    let searchParsed: unknown;
    try { searchParsed = JSON.parse(searchResult); } catch { return searchResult; }

    if (searchParsed && typeof searchParsed === "object") {
      const data = searchParsed as Record<string, unknown>;
      const products = data.products as Record<string, unknown> | undefined;
      if (products?.edges && Array.isArray(products.edges)) {
        const originalHandle = product?.handle;
        const filtered = (products.edges as Array<{ node: Record<string, unknown> }>)
          .filter(e => e.node?.handle !== originalHandle);
        return JSON.stringify({
          ...data,
          products: { ...products, edges: filtered.slice(0, 4) },
          _source: "cross_sell",
          _heading: "Frequently bought together",
        });
      }
    }

    return searchResult;
  } catch (err) {
    console.error("[recommendation-service] Failed to get cross-sell products:", err instanceof Error ? err.message : err);
    return JSON.stringify({ products: { edges: [] } });
  }
}
