import { LRUCache } from "./lru-cache";

export interface CustomerAccountDiscovery {
  mcp_api: string;
  authorization_endpoint: string;
  token_endpoint: string;
}

const discoveryCache = new LRUCache<CustomerAccountDiscovery | null>(500, 60 * 60 * 1000, "customer-account-discovery");

export function invalidateDiscoveryCache(storeDomain: string): void {
  discoveryCache.delete(storeDomain);
}

export async function discoverCustomerAccountMCP(storeDomain: string): Promise<CustomerAccountDiscovery | null> {
  const cached = discoveryCache.get(storeDomain);
  if (cached !== undefined) return cached;

  try {
    const response = await fetch(`https://${storeDomain}/.well-known/customer-account-api`, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.log(`[customer-account-discovery] store="${storeDomain}" status=${response.status} — Customer Accounts MCP not available`);
      discoveryCache.set(storeDomain, null);
      return null;
    }

    const doc = (await response.json()) as Record<string, unknown>;
    const mcpApi = doc.mcp_api as string | undefined;
    const authEndpoint = doc.authorization_endpoint as string | undefined;
    const tokenEndpoint = doc.token_endpoint as string | undefined;

    if (!mcpApi || !authEndpoint || !tokenEndpoint) {
      console.warn(`[customer-account-discovery] store="${storeDomain}" — discovery document missing required fields`);
      discoveryCache.set(storeDomain, null);
      return null;
    }

    const result: CustomerAccountDiscovery = {
      mcp_api: mcpApi,
      authorization_endpoint: authEndpoint,
      token_endpoint: tokenEndpoint,
    };

    console.log(`[customer-account-discovery] store="${storeDomain}" status=ok mcp_api="${mcpApi}"`);
    discoveryCache.set(storeDomain, result);
    return result;
  } catch (err) {
    console.warn(`[customer-account-discovery] store="${storeDomain}" error="${err instanceof Error ? err.message : "Unknown"}"`);
    discoveryCache.set(storeDomain, null);
    return null;
  }
}

export function resolveClientId(store: { customerAccountClientId?: string | null; storeDomain: string }): string | null {
  if (store.customerAccountClientId) return store.customerAccountClientId;
  return process.env.SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID || null;
}
