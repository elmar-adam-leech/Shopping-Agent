import type { MCPTool } from "./mcp-client";
import { LRUCache } from "./lru-cache";
import { db } from "@workspace/db";
import { storesTable, type UCPCapabilitiesJson } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export interface UCPDiscoveryDocument {
  version: string;
  business: {
    name?: string;
    url?: string;
    description?: string;
  };
  services?: Array<{
    type: string;
    transport?: string;
    url?: string;
    capabilities?: string[];
  }>;
  payment_handlers?: Array<{
    type: string;
    supported_methods?: string[];
  }>;
}

export interface UCPNegotiationResult {
  storeDomain: string;
  success: boolean;
  version?: string;
  servicesCount: number;
  capabilitiesFound: string[];
  paymentMethodsFound: string[];
  source: "network" | "database" | "cache";
  error?: string;
  timestamp: number;
}

const ucpCache = new LRUCache<UCPDiscoveryDocument | null>(1000, 5 * 60 * 1000, "ucp-discovery");

const DEFAULT_REFRESH_INTERVAL_MS = 3600000;

function docToCapabilitiesJson(doc: UCPDiscoveryDocument): UCPCapabilitiesJson {
  return {
    version: doc.version,
    services: (doc.services ?? []).map(s => ({
      type: s.type,
      transport: s.transport,
      url: s.url,
      capabilities: s.capabilities,
    })),
    paymentHandlers: (doc.payment_handlers ?? []).map(p => ({
      type: p.type,
      supportedMethods: p.supported_methods,
    })),
    businessName: doc.business?.name,
    businessUrl: doc.business?.url,
    businessDescription: doc.business?.description,
  };
}

function capabilitiesJsonToDoc(caps: UCPCapabilitiesJson): UCPDiscoveryDocument {
  const services = Array.isArray(caps.services) ? caps.services : [];
  const paymentHandlers = Array.isArray(caps.paymentHandlers) ? caps.paymentHandlers : [];

  return {
    version: caps.version ?? "unknown",
    business: {
      name: caps.businessName,
      url: caps.businessUrl,
      description: caps.businessDescription,
    },
    services: services.map(s => ({
      type: String(s.type ?? ""),
      transport: s.transport,
      url: s.url,
      capabilities: Array.isArray(s.capabilities) ? s.capabilities : undefined,
    })),
    payment_handlers: paymentHandlers.map(p => ({
      type: String(p.type ?? ""),
      supported_methods: Array.isArray(p.supportedMethods) ? p.supportedMethods : undefined,
    })),
  };
}

function buildNegotiationResult(
  storeDomain: string,
  doc: UCPDiscoveryDocument | null,
  source: UCPNegotiationResult["source"],
  error?: string
): UCPNegotiationResult {
  if (!doc) {
    return {
      storeDomain,
      success: false,
      servicesCount: 0,
      capabilitiesFound: [],
      paymentMethodsFound: [],
      source,
      error: error ?? "UCP not available",
      timestamp: Date.now(),
    };
  }

  const allCaps: string[] = [];
  for (const svc of doc.services ?? []) {
    allCaps.push(svc.type);
    if (svc.capabilities) {
      for (const c of svc.capabilities) {
        allCaps.push(`${svc.type}.${c}`);
      }
    }
  }

  const paymentMethods: string[] = [];
  for (const ph of doc.payment_handlers ?? []) {
    if (ph.supported_methods) {
      paymentMethods.push(...ph.supported_methods);
    }
  }

  return {
    storeDomain,
    success: true,
    version: doc.version,
    servicesCount: doc.services?.length ?? 0,
    capabilitiesFound: allCaps,
    paymentMethodsFound: paymentMethods,
    source,
    timestamp: Date.now(),
  };
}

export function logNegotiationResult(result: UCPNegotiationResult): void {
  if (result.success) {
    console.log(
      `[ucp-negotiation] store="${result.storeDomain}" status=ok version=${result.version} source=${result.source} services=${result.servicesCount} capabilities=[${result.capabilitiesFound.join(",")}] payments=[${result.paymentMethodsFound.join(",")}]`
    );
  } else {
    console.log(
      `[ucp-negotiation] store="${result.storeDomain}" status=failed source=${result.source} error="${result.error}"`
    );
  }
}

type NetworkResult =
  | { status: "ok"; doc: UCPDiscoveryDocument }
  | { status: "not_found" }
  | { status: "error"; reason: string };

async function fetchFromNetwork(storeDomain: string): Promise<NetworkResult> {
  const response = await fetch(`https://${storeDomain}/.well-known/ucp`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "UCP-Version": "2026-01-11",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (response.status === 404) {
    return { status: "not_found" };
  }

  if (!response.ok) {
    return { status: "error", reason: `HTTP ${response.status}` };
  }

  const doc = (await response.json()) as UCPDiscoveryDocument;
  return { status: "ok", doc };
}

async function loadFromDB(storeDomain: string): Promise<{ caps: UCPCapabilitiesJson | null; lastDiscovered: Date | null; refreshInterval: number }> {
  try {
    const [row] = await db
      .select({
        ucpCapabilities: storesTable.ucpCapabilities,
        ucpLastDiscoveredAt: storesTable.ucpLastDiscoveredAt,
        ucpRefreshIntervalMs: storesTable.ucpRefreshIntervalMs,
      })
      .from(storesTable)
      .where(eq(storesTable.storeDomain, storeDomain));

    if (!row) return { caps: null, lastDiscovered: null, refreshInterval: DEFAULT_REFRESH_INTERVAL_MS };

    return {
      caps: row.ucpCapabilities ?? null,
      lastDiscovered: row.ucpLastDiscoveredAt,
      refreshInterval: row.ucpRefreshIntervalMs,
    };
  } catch (err) {
    console.warn(`[ucp-discovery] DB load failed for store="${storeDomain}":`, err instanceof Error ? err.message : err);
    return { caps: null, lastDiscovered: null, refreshInterval: DEFAULT_REFRESH_INTERVAL_MS };
  }
}

async function persistToDB(storeDomain: string, doc: UCPDiscoveryDocument | null): Promise<void> {
  try {
    const capsJson = doc ? docToCapabilitiesJson(doc) : null;
    await db
      .update(storesTable)
      .set({
        ucpCapabilities: capsJson,
        ucpLastDiscoveredAt: new Date(),
      })
      .where(eq(storesTable.storeDomain, storeDomain));
  } catch (err) {
    console.warn(`[ucp-discovery] DB persist failed for store="${storeDomain}":`, err instanceof Error ? err.message : err);
  }
}

export async function discoverUCPCapabilities(storeDomain: string): Promise<{ doc: UCPDiscoveryDocument | null; negotiation: UCPNegotiationResult }> {
  const cached = ucpCache.get(storeDomain);
  if (cached !== undefined) {
    const result = buildNegotiationResult(storeDomain, cached, "cache");
    return { doc: cached, negotiation: result };
  }

  const { caps, lastDiscovered, refreshInterval } = await loadFromDB(storeDomain);

  if (lastDiscovered) {
    const age = Date.now() - lastDiscovered.getTime();
    if (age < refreshInterval) {
      const doc = caps ? capabilitiesJsonToDoc(caps) : null;
      ucpCache.set(storeDomain, doc);
      const result = buildNegotiationResult(storeDomain, doc, "database");
      return { doc, negotiation: result };
    }
  }

  let networkResult: NetworkResult;
  try {
    networkResult = await fetchFromNetwork(storeDomain);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return handleNetworkFailure(storeDomain, caps, errMsg);
  }

  if (networkResult.status === "ok") {
    const doc = networkResult.doc;
    ucpCache.set(storeDomain, doc);
    persistToDB(storeDomain, doc);
    const result = buildNegotiationResult(storeDomain, doc, "network");
    return { doc, negotiation: result };
  }

  if (networkResult.status === "not_found") {
    ucpCache.set(storeDomain, null);
    persistToDB(storeDomain, null);
    const result = buildNegotiationResult(storeDomain, null, "network", "UCP not available (404)");
    return { doc: null, negotiation: result };
  }

  return handleNetworkFailure(storeDomain, caps, networkResult.reason);
}

function handleNetworkFailure(
  storeDomain: string,
  staleCaps: UCPCapabilitiesJson | null,
  errorReason: string
): { doc: UCPDiscoveryDocument | null; negotiation: UCPNegotiationResult } {
  if (staleCaps) {
    const doc = capabilitiesJsonToDoc(staleCaps);
    ucpCache.set(storeDomain, doc);
    const result = buildNegotiationResult(storeDomain, doc, "database", `Refresh failed (${errorReason}), using stale DB cache`);
    result.success = true;
    return { doc, negotiation: result };
  }

  console.warn(`[ucp-discovery] store="${storeDomain}" status=error error="${errorReason}" — continuing with standard MCP tools`);
  ucpCache.set(storeDomain, null);
  const result = buildNegotiationResult(storeDomain, null, "network", errorReason);
  return { doc: null, negotiation: result };
}

const DYNAMIC_TOOL_TEMPLATES: Record<string, (serviceType: string, capability?: string) => MCPTool | null> = {
  checkout: () => null,
  "checkout.create": () => ({
    name: "create_checkout",
    description: "Create a new UCP checkout session for purchasing items",
    inputSchema: {
      type: "object",
      properties: {
        line_items: {
          type: "array",
          description: "Items to include in the checkout",
          items: {
            type: "object",
            properties: {
              product_id: { type: "string", description: "Product identifier" },
              variant_id: { type: "string", description: "Variant identifier" },
              quantity: { type: "number", description: "Quantity to purchase" },
            },
            required: ["product_id", "quantity"],
          },
        },
        customer_email: { type: "string", description: "Customer email address" },
      },
      required: ["line_items"],
    },
  }),
  "checkout.update": () => ({
    name: "update_checkout",
    description: "Update an existing UCP checkout session (modify items, shipping, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        checkout_session_id: { type: "string", description: "The checkout session ID" },
        line_items: {
          type: "array",
          description: "Updated line items",
          items: {
            type: "object",
            properties: {
              product_id: { type: "string" },
              variant_id: { type: "string" },
              quantity: { type: "number" },
            },
          },
        },
        shipping_address: {
          type: "object",
          description: "Shipping address",
          properties: {
            line1: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            postal_code: { type: "string" },
            country: { type: "string" },
          },
        },
      },
      required: ["checkout_session_id"],
    },
  }),
  "checkout.complete": () => ({
    name: "complete_checkout",
    description: "Complete/finalize a UCP checkout session to place the order",
    inputSchema: {
      type: "object",
      properties: {
        checkout_session_id: { type: "string", description: "The checkout session ID to complete" },
        payment_method: { type: "string", description: "Payment method identifier" },
      },
      required: ["checkout_session_id"],
    },
  }),
  orders: () => null,
  "orders.status": () => ({
    name: "get_order_status",
    description: "Get the status of an order including fulfillment and tracking information",
    inputSchema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "The order ID to look up" },
      },
      required: ["order_id"],
    },
  }),
  "orders.history": () => ({
    name: "get_orders",
    description: "List the customer's recent orders with status and item details",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of orders to return (default 10)" },
      },
    },
  }),
  "orders.returns": () => ({
    name: "request_return",
    description: "Initiate a return request for an order. Requires order ID and reason for return.",
    inputSchema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "The order ID to return" },
        reason: { type: "string", description: "Reason for the return (e.g. defective, wrong_item, changed_mind, not_as_described)" },
        line_items: {
          type: "array",
          description: "Specific items to return. If not provided, all items are returned.",
          items: {
            type: "object",
            properties: {
              line_item_id: { type: "string", description: "The line item ID to return" },
              quantity: { type: "number", description: "Quantity to return" },
            },
            required: ["line_item_id", "quantity"],
          },
        },
        note: { type: "string", description: "Additional note from the customer" },
      },
      required: ["order_id", "reason"],
    },
  }),
  subscriptions: () => null,
  "subscriptions.create": () => ({
    name: "create_subscription",
    description: "Create a new subscription for recurring product delivery",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Product to subscribe to" },
        variant_id: { type: "string", description: "Variant identifier" },
        interval: { type: "string", description: "Delivery interval (e.g. 'monthly', 'weekly', 'biweekly')" },
        quantity: { type: "number", description: "Quantity per delivery" },
        customer_email: { type: "string", description: "Customer email" },
      },
      required: ["product_id", "interval"],
    },
  }),
  "subscriptions.manage": () => ({
    name: "manage_subscription",
    description: "View, pause, resume, or cancel an existing subscription",
    inputSchema: {
      type: "object",
      properties: {
        subscription_id: { type: "string", description: "The subscription ID" },
        action: { type: "string", description: "Action to take: 'view', 'pause', 'resume', 'cancel', 'update_interval'" },
        new_interval: { type: "string", description: "New delivery interval (only for update_interval action)" },
      },
      required: ["subscription_id", "action"],
    },
  }),
  loyalty: () => null,
  "loyalty.balance": () => ({
    name: "get_loyalty_balance",
    description: "Get the customer's loyalty points balance and tier status",
    inputSchema: {
      type: "object",
      properties: {
        customer_email: { type: "string", description: "Customer email to look up" },
      },
      required: ["customer_email"],
    },
  }),
  "loyalty.redeem": () => ({
    name: "redeem_loyalty_points",
    description: "Redeem loyalty points for a discount on an order",
    inputSchema: {
      type: "object",
      properties: {
        customer_email: { type: "string", description: "Customer email" },
        points: { type: "number", description: "Number of points to redeem" },
        checkout_session_id: { type: "string", description: "Checkout session to apply discount to" },
      },
      required: ["customer_email", "points"],
    },
  }),
  discounts: () => null,
  "discounts.apply": () => ({
    name: "apply_discount",
    description: "Apply a discount or promo code to a checkout session",
    inputSchema: {
      type: "object",
      properties: {
        checkout_session_id: { type: "string", description: "The checkout session ID" },
        code: { type: "string", description: "Discount or promo code to apply" },
      },
      required: ["checkout_session_id", "code"],
    },
  }),
  "discounts.list": () => ({
    name: "list_available_discounts",
    description: "List currently available promotions and discounts for the store",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Optional product ID to check specific discounts for" },
      },
    },
  }),
  preorders: () => null,
  "preorders.create": () => ({
    name: "create_preorder",
    description: "Create a pre-order for an upcoming or out-of-stock product",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Product to pre-order" },
        variant_id: { type: "string", description: "Variant identifier" },
        quantity: { type: "number", description: "Quantity to pre-order" },
        customer_email: { type: "string", description: "Customer email" },
      },
      required: ["product_id", "quantity"],
    },
  }),
  wishlists: () => null,
  "wishlists.manage": () => ({
    name: "manage_wishlist",
    description: "Add, remove, or view items on the customer's wishlist",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "Action: 'add', 'remove', 'view'" },
        customer_email: { type: "string", description: "Customer email" },
        product_id: { type: "string", description: "Product ID (for add/remove)" },
        variant_id: { type: "string", description: "Variant ID (for add/remove)" },
      },
      required: ["action", "customer_email"],
    },
  }),
  gifting: () => null,
  "gifting.create": () => ({
    name: "create_gift_order",
    description: "Create a gift order with gift wrapping and a personal message",
    inputSchema: {
      type: "object",
      properties: {
        checkout_session_id: { type: "string", description: "The checkout session ID" },
        gift_message: { type: "string", description: "Personal gift message" },
        recipient_email: { type: "string", description: "Recipient email for gift notification" },
        gift_wrapping: { type: "boolean", description: "Whether to add gift wrapping" },
      },
      required: ["checkout_session_id"],
    },
  }),
};

const DEFAULT_CHECKOUT_CAPS = ["create", "update", "complete"];
const DEFAULT_ORDER_CAPS = ["status", "history", "returns"];

function resolveServiceCapabilities(service: { type: string; capabilities?: string[] }): string[] {
  if (service.capabilities && service.capabilities.length > 0) {
    return service.capabilities;
  }
  if (service.type === "checkout") return DEFAULT_CHECKOUT_CAPS;
  if (service.type === "orders") return DEFAULT_ORDER_CAPS;
  return [];
}

const UCP_GENERIC_DISPATCHER_NAME = "ucp_invoke";

function buildGenericDispatcher(unmappedCapabilities: string[]): MCPTool {
  return {
    name: UCP_GENERIC_DISPATCHER_NAME,
    description: `Invoke a UCP capability that was dynamically discovered but has no dedicated tool. Available capabilities: ${unmappedCapabilities.join(", ")}. Use this tool by specifying the service type and capability name.`,
    inputSchema: {
      type: "object",
      properties: {
        service: {
          type: "string",
          description: "The UCP service type (e.g. 'rewards', 'bundles')",
        },
        capability: {
          type: "string",
          description: "The specific capability to invoke (e.g. 'list', 'create')",
        },
        params: {
          type: "object",
          description: "Parameters to pass to the UCP capability",
        },
      },
      required: ["service", "capability"],
    },
  };
}

export function generateToolsFromCapabilities(ucpDoc: UCPDiscoveryDocument): MCPTool[] {
  const tools: MCPTool[] = [];
  const addedNames = new Set<string>();
  const unmappedCapabilities: string[] = [];

  if (!ucpDoc.services || ucpDoc.services.length === 0) {
    return [];
  }

  for (const service of ucpDoc.services) {
    const serviceKey = service.type;
    const capabilities = resolveServiceCapabilities(service);

    if (capabilities.length > 0) {
      for (const cap of capabilities) {
        const templateKey = `${serviceKey}.${cap}`;
        const generator = DYNAMIC_TOOL_TEMPLATES[templateKey];
        let tool: MCPTool | null = null;

        if (generator) {
          tool = generator(serviceKey, cap);
        }

        if (tool && !addedNames.has(tool.name)) {
          tools.push(tool);
          addedNames.add(tool.name);
        } else if (!tool) {
          unmappedCapabilities.push(`${serviceKey}.${cap}`);
        }
      }
    } else {
      const serviceGenerator = DYNAMIC_TOOL_TEMPLATES[serviceKey];
      let tool: MCPTool | null = null;

      if (serviceGenerator) {
        tool = serviceGenerator(serviceKey);
      }

      if (tool && !addedNames.has(tool.name)) {
        tools.push(tool);
        addedNames.add(tool.name);
      } else if (!tool) {
        unmappedCapabilities.push(serviceKey);
      }
    }
  }

  if (unmappedCapabilities.length > 0) {
    tools.push(buildGenericDispatcher(unmappedCapabilities));
  }

  return tools;
}

const ALL_UCP_TOOL_NAMES = new Set([
  UCP_GENERIC_DISPATCHER_NAME,
  "create_checkout", "update_checkout", "complete_checkout",
  "get_order_status", "get_orders", "request_return",
  "create_subscription", "manage_subscription",
  "get_loyalty_balance", "redeem_loyalty_points",
  "apply_discount", "list_available_discounts",
  "create_preorder",
  "manage_wishlist",
  "create_gift_order",
]);

export function getUCPToolNames(ucpDoc?: UCPDiscoveryDocument | null): Set<string> {
  if (ucpDoc) {
    return new Set(generateToolsFromCapabilities(ucpDoc).map(t => t.name));
  }
  return new Set(ALL_UCP_TOOL_NAMES);
}

export function extractAllCapabilities(ucpDoc: UCPDiscoveryDocument): string[] {
  const caps: string[] = [];
  for (const svc of ucpDoc.services ?? []) {
    caps.push(svc.type);
    if (svc.capabilities) {
      for (const c of svc.capabilities) {
        caps.push(`${svc.type}.${c}`);
      }
    }
  }
  return caps;
}
