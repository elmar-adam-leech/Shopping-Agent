export interface NormalizedOrderItem {
  title: string;
  quantity: number;
  price: string;
  currencyCode: string;
  imageUrl?: string;
  variantTitle?: string;
  productId?: string;
}

export interface NormalizedFulfillment {
  status: "unfulfilled" | "in_transit" | "out_for_delivery" | "delivered" | "attempted_delivery" | "failure";
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  estimatedDelivery?: string;
  updatedAt?: string;
}

export interface NormalizedOrder {
  orderId: string;
  orderNumber: string;
  status: "open" | "closed" | "cancelled";
  financialStatus: string;
  fulfillmentStatus: "unfulfilled" | "partially_fulfilled" | "fulfilled";
  createdAt: string;
  totalPrice: string;
  currencyCode: string;
  items: NormalizedOrderItem[];
  fulfillments: NormalizedFulfillment[];
  trackingUrl?: string;
  returnEligible: boolean;
  cancelledAt?: string;
}

export interface NormalizedReturnRequest {
  returnId: string;
  orderId: string;
  status: "requested" | "approved" | "rejected" | "completed";
  reason: string;
  createdAt: string;
  items: Array<{ title: string; quantity: number }>;
}

export function normalizeOrderFromMCP(raw: Record<string, unknown>): NormalizedOrder {
  const order = (raw.order || raw) as Record<string, unknown>;

  const items: NormalizedOrderItem[] = [];
  const lineItems = order.lineItems || order.line_items;
  if (lineItems && typeof lineItems === "object") {
    const edges = (lineItems as Record<string, unknown>).edges as Array<{ node: Record<string, unknown> }> | undefined;
    const itemList = edges ? edges.map(e => e.node) : Array.isArray(lineItems) ? lineItems as Record<string, unknown>[] : [];
    for (const item of itemList) {
      items.push({
        title: String(item.title || item.name || "Unknown Item"),
        quantity: Number(item.quantity || 1),
        price: String(item.price || (item.originalTotalPrice as Record<string, unknown>)?.amount || "0.00"),
        currencyCode: String(item.currencyCode || (item.originalTotalPrice as Record<string, unknown>)?.currencyCode || "USD"),
        imageUrl: (item.image as Record<string, unknown>)?.url as string | undefined
          || (item.variant as Record<string, unknown>)?.image?.toString(),
        variantTitle: item.variantTitle as string | undefined || item.variant_title as string | undefined,
        productId: item.productId as string | undefined || item.product_id as string | undefined,
      });
    }
  }

  const fulfillments: NormalizedFulfillment[] = [];
  const rawFulfillments = order.fulfillments || order.successfulFulfillments;
  if (rawFulfillments && typeof rawFulfillments === "object") {
    const edges = (rawFulfillments as Record<string, unknown>).edges as Array<{ node: Record<string, unknown> }> | undefined;
    const fList = edges ? edges.map(e => e.node) : Array.isArray(rawFulfillments) ? rawFulfillments as Record<string, unknown>[] : [];
    for (const f of fList) {
      const trackingInfo = (f.trackingInfo as Record<string, unknown>[]) ?? [];
      const firstTracking = trackingInfo[0] as Record<string, unknown> | undefined;
      fulfillments.push({
        status: mapFulfillmentStatus(String(f.status || f.displayStatus || "unfulfilled")),
        trackingNumber: firstTracking?.number as string | undefined || f.trackingNumber as string | undefined || f.tracking_number as string | undefined,
        trackingUrl: firstTracking?.url as string | undefined || f.trackingUrl as string | undefined || f.tracking_url as string | undefined,
        carrier: firstTracking?.company as string | undefined || f.trackingCompany as string | undefined || f.tracking_company as string | undefined,
        estimatedDelivery: f.estimatedDeliveryAt as string | undefined || f.estimated_delivery as string | undefined,
        updatedAt: f.updatedAt as string | undefined || f.updated_at as string | undefined,
      });
    }
  }

  const overallFulfillmentStatus = order.fulfillmentStatus || order.fulfillment_status || "unfulfilled";
  const trackingUrl = fulfillments.find(f => f.trackingUrl)?.trackingUrl;

  const createdAt = String(order.createdAt || order.created_at || order.processedAt || new Date().toISOString());
  const daysSinceOrder = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const returnEligible = daysSinceOrder <= 30 && String(order.status || "open").toLowerCase() !== "cancelled";

  return {
    orderId: String(order.id || order.orderId || order.order_id || ""),
    orderNumber: String(order.orderNumber || order.order_number || order.name || ""),
    status: mapOrderStatus(String(order.status || "open")),
    financialStatus: String(order.financialStatus || order.financial_status || "paid"),
    fulfillmentStatus: mapOverallFulfillmentStatus(String(overallFulfillmentStatus)),
    createdAt,
    totalPrice: String(
      (order.totalPrice as Record<string, unknown>)?.amount
      || order.totalPrice
      || order.total_price
      || "0.00"
    ),
    currencyCode: String(
      (order.totalPrice as Record<string, unknown>)?.currencyCode
      || order.currencyCode
      || order.currency
      || "USD"
    ),
    items,
    fulfillments,
    trackingUrl,
    returnEligible,
    cancelledAt: order.cancelledAt as string | undefined || order.cancelled_at as string | undefined,
  };
}

export function normalizeReturnFromMCP(raw: Record<string, unknown>): NormalizedReturnRequest {
  const ret = (raw.return || raw) as Record<string, unknown>;
  const items: Array<{ title: string; quantity: number }> = [];
  const rawItems = ret.returnLineItems || ret.items || ret.line_items;
  if (Array.isArray(rawItems)) {
    for (const item of rawItems as Record<string, unknown>[]) {
      items.push({
        title: String(item.title || item.name || "Item"),
        quantity: Number(item.quantity || 1),
      });
    }
  }

  return {
    returnId: String(ret.id || ret.returnId || ret.return_id || ""),
    orderId: String(ret.orderId || ret.order_id || ""),
    status: mapReturnStatus(String(ret.status || "requested")),
    reason: String(ret.reason || ret.note || ""),
    createdAt: String(ret.createdAt || ret.created_at || new Date().toISOString()),
    items,
  };
}

function mapFulfillmentStatus(status: string): NormalizedFulfillment["status"] {
  const s = status.toLowerCase().replace(/_/g, " ");
  if (s.includes("deliver") && !s.includes("attempt") && !s.includes("out")) return "delivered";
  if (s.includes("out for") || s.includes("out_for")) return "out_for_delivery";
  if (s.includes("transit") || s.includes("shipped") || s.includes("in transit")) return "in_transit";
  if (s.includes("attempt")) return "attempted_delivery";
  if (s.includes("fail")) return "failure";
  return "unfulfilled";
}

function mapOrderStatus(status: string): NormalizedOrder["status"] {
  const s = status.toLowerCase();
  if (s === "closed" || s === "completed") return "closed";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  return "open";
}

function mapOverallFulfillmentStatus(status: string): NormalizedOrder["fulfillmentStatus"] {
  const s = status.toLowerCase().replace(/_/g, "");
  if (s.includes("fulfilled") && !s.includes("unfulfilled") && !s.includes("partial")) return "fulfilled";
  if (s.includes("partial")) return "partially_fulfilled";
  return "unfulfilled";
}

function mapReturnStatus(status: string): NormalizedReturnRequest["status"] {
  const s = status.toLowerCase();
  if (s === "approved" || s === "accepted") return "approved";
  if (s === "rejected" || s === "declined" || s === "denied") return "rejected";
  if (s === "completed" || s === "closed" || s === "resolved") return "completed";
  return "requested";
}
