import { ProductCard, type ProductCardData } from "./ProductCard";
import { ProductCarousel } from "./ProductCarousel";
import { ComparisonTable } from "./ComparisonTable";
import { CartSummaryCard } from "./CartSummaryCard";
import { CollectionCard, type CollectionCardData } from "./CollectionCard";
import { ArticleCard, type BlogArticleData } from "./ArticleCard";
import { OrderCard, type OrderCardData } from "./OrderCard";
import { OrderStatusCard, type OrderStatusCardData, type FulfillmentData } from "./OrderStatusCard";
import { ReturnConfirmationCard, type ReturnConfirmationData } from "./ReturnConfirmationCard";

interface BlogData {
  title?: string;
  handle?: string;
  articles?: { edges?: Array<{ node: BlogArticleData }> };
}

function str(val: unknown): string | undefined {
  return val != null ? String(val) : undefined;
}

function normalizeOrderData(raw: Record<string, unknown>): OrderCardData {
  const items: OrderCardData['items'] = [];
  const lineItems = raw.lineItems || raw.line_items;
  if (lineItems && typeof lineItems === 'object') {
    const edges = (lineItems as Record<string, unknown>).edges as Array<{ node: Record<string, unknown> }> | undefined;
    const nodes = (lineItems as Record<string, unknown>).nodes as Record<string, unknown>[] | undefined;
    const list = edges ? edges.map(e => e.node) : nodes || (Array.isArray(lineItems) ? lineItems as Record<string, unknown>[] : []);
    for (const item of list) {
      items.push({
        title: str(item.title || item.name),
        quantity: Number(item.quantity || 1),
        price: str(item.price || (item.originalTotalPrice as Record<string, unknown>)?.amount),
        currencyCode: str(item.currencyCode || (item.originalTotalPrice as Record<string, unknown>)?.currencyCode),
        imageUrl: str((item.image as Record<string, unknown>)?.url),
        variantTitle: str(item.variantTitle || item.variant_title),
      });
    }
  }

  return {
    orderId: str(raw.id || raw.orderId || raw.order_id),
    orderNumber: str(raw.orderNumber || raw.order_number || raw.name),
    status: str(raw.status),
    financialStatus: str(raw.financialStatus || raw.financial_status),
    fulfillmentStatus: str(raw.fulfillmentStatus || raw.fulfillment_status),
    createdAt: str(raw.createdAt || raw.created_at || raw.processedAt),
    totalPrice: str((raw.totalPrice as Record<string, unknown>)?.amount || raw.totalPrice || raw.total_price),
    currencyCode: str((raw.totalPrice as Record<string, unknown>)?.currencyCode || raw.currencyCode || raw.currency),
    items,
    trackingUrl: str(raw.trackingUrl || raw.tracking_url),
    returnEligible: raw.returnEligible === true || raw.return_eligible === true,
  };
}

function normalizeOrderStatusData(raw: Record<string, unknown>): OrderStatusCardData {
  const fulfillments: FulfillmentData[] = [];
  const rawFulfillments = raw.fulfillments || raw.successfulFulfillments;
  if (rawFulfillments && typeof rawFulfillments === 'object') {
    const edges = (rawFulfillments as Record<string, unknown>).edges as Array<{ node: Record<string, unknown> }> | undefined;
    const nodes = (rawFulfillments as Record<string, unknown>).nodes as Record<string, unknown>[] | undefined;
    const list = edges ? edges.map(e => e.node) : nodes || (Array.isArray(rawFulfillments) ? rawFulfillments as Record<string, unknown>[] : []);
    for (const f of list) {
      const trackingInfo = f.trackingInfo as Record<string, unknown>[] | undefined;
      const first = trackingInfo?.[0];
      fulfillments.push({
        status: str(f.status || f.displayStatus),
        trackingNumber: str(first?.number || f.trackingNumber || f.tracking_number),
        trackingUrl: str(first?.url || f.trackingUrl || f.tracking_url),
        carrier: str(first?.company || f.trackingCompany || f.tracking_company),
        estimatedDelivery: str(f.estimatedDeliveryAt || f.estimated_delivery),
        updatedAt: str(f.updatedAt || f.updated_at),
      });
    }
  }

  return {
    orderId: str(raw.id || raw.orderId || raw.order_id),
    orderNumber: str(raw.orderNumber || raw.order_number || raw.name),
    status: str(raw.status),
    fulfillmentStatus: str(raw.fulfillmentStatus || raw.fulfillment_status),
    fulfillments,
    trackingUrl: str(raw.trackingUrl || raw.tracking_url) || fulfillments.find(f => f.trackingUrl)?.trackingUrl,
    createdAt: str(raw.createdAt || raw.created_at),
    totalPrice: str((raw.totalPrice as Record<string, unknown>)?.amount || raw.totalPrice || raw.total_price),
    currencyCode: str((raw.totalPrice as Record<string, unknown>)?.currencyCode || raw.currencyCode || raw.currency),
  };
}

function normalizeReturnData(raw: Record<string, unknown>): ReturnConfirmationData {
  const items: Array<{ title?: string; quantity?: number }> = [];
  const rawItems = raw.returnLineItems || raw.items || raw.line_items;
  if (Array.isArray(rawItems)) {
    for (const item of rawItems as Record<string, unknown>[]) {
      items.push({
        title: str(item.title || item.name),
        quantity: Number(item.quantity || 1),
      });
    }
  }

  return {
    returnId: str(raw.id || raw.returnId || raw.return_id),
    orderId: str(raw.orderId || raw.order_id),
    status: str(raw.status),
    reason: str(raw.reason || raw.note),
    createdAt: str(raw.createdAt || raw.created_at),
    items,
  };
}

function tryParseToolResult(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function ToolResultCards({ toolName, content }: { toolName: string; content: string }) {
  if (toolName === 'add_to_cart') {
    return <CartSummaryCard />;
  }

  const parsed = tryParseToolResult(content);
  if (!parsed || typeof parsed !== 'object') return null;

  const data = parsed as Record<string, unknown>;

  if (toolName === 'search_products' || toolName === 'get_product' || toolName === 'compare_products') {
    const products: ProductCardData[] = [];
    if (data.products && Array.isArray((data.products as Record<string, unknown>).edges)) {
      for (const edge of (data.products as { edges: Array<{ node: ProductCardData }> }).edges) {
        products.push(edge.node);
      }
    } else if (data.product && typeof data.product === 'object') {
      products.push(data.product as ProductCardData);
    } else if (Array.isArray(data)) {
      products.push(...(data as ProductCardData[]));
    }

    if (products.length === 0) return null;

    const renderHint = typeof data._renderHint === 'string' ? data._renderHint : undefined;

    if (renderHint === 'comparison' || (toolName === 'compare_products' && products.length >= 2 && products.length <= 4)) {
      return <ComparisonTable products={products.slice(0, 4)} />;
    }

    if (products.length >= 3) {
      return <ProductCarousel products={products.slice(0, 12)} />;
    }

    return (
      <div className="grid gap-2 mt-2">
        {products.slice(0, 6).map((p, i) => (
          <ProductCard key={i} product={p} />
        ))}
      </div>
    );
  }

  if (toolName === 'get_collections') {
    const collections: CollectionCardData[] = [];
    if (data.collections && Array.isArray((data.collections as Record<string, unknown>).edges)) {
      for (const edge of (data.collections as { edges: Array<{ node: CollectionCardData }> }).edges) {
        collections.push(edge.node);
      }
    }

    if (collections.length === 0) return null;

    return (
      <div className="grid gap-2 mt-2">
        {collections.slice(0, 6).map((c, i) => (
          <CollectionCard key={i} collection={c} />
        ))}
      </div>
    );
  }

  if (toolName === 'get_orders') {
    const rawOrders: Record<string, unknown>[] = [];
    if (data.orders && Array.isArray((data.orders as Record<string, unknown>).edges)) {
      for (const edge of (data.orders as { edges: Array<{ node: Record<string, unknown> }> }).edges) {
        rawOrders.push(edge.node);
      }
    } else if (data.orders && Array.isArray((data.orders as Record<string, unknown>).nodes)) {
      rawOrders.push(...(data.orders as { nodes: Record<string, unknown>[] }).nodes);
    } else if (Array.isArray(data.orders)) {
      rawOrders.push(...(data.orders as Record<string, unknown>[]));
    } else if (data.orderId || data.orderNumber || data.order_id || data.order_number) {
      rawOrders.push(data);
    }

    if (rawOrders.length === 0) return null;

    const orders: OrderCardData[] = rawOrders.map(normalizeOrderData);

    return (
      <div className="grid gap-2 mt-2">
        {orders.slice(0, 10).map((o, i) => (
          <OrderCard key={i} order={o} />
        ))}
      </div>
    );
  }

  if (toolName === 'get_order_status') {
    const raw = (data.order || data) as Record<string, unknown>;
    if (!raw.orderId && !raw.orderNumber && !raw.order_id && !raw.order_number && !raw.id) return null;

    const order = normalizeOrderStatusData(raw);

    return (
      <div className="mt-2">
        <OrderStatusCard order={order} />
      </div>
    );
  }

  if (toolName === 'request_return') {
    const raw = (data.return || data) as Record<string, unknown>;
    if (!raw.returnId && !raw.return_id && !raw.orderId && !raw.order_id && !raw.id) return null;

    const returnData = normalizeReturnData(raw);

    return (
      <div className="mt-2">
        <ReturnConfirmationCard returnData={returnData} />
      </div>
    );
  }

  if (toolName === 'get_blogs') {
    const articles: BlogArticleData[] = [];
    if (data.blogs && Array.isArray((data.blogs as Record<string, unknown>).edges)) {
      for (const blogEdge of (data.blogs as { edges: Array<{ node: BlogData }> }).edges) {
        const blog = blogEdge.node;
        if (blog.articles?.edges) {
          for (const articleEdge of blog.articles.edges) {
            articles.push(articleEdge.node);
          }
        }
      }
    }

    if (articles.length === 0) return null;

    return (
      <div className="grid gap-2 mt-2">
        {articles.slice(0, 6).map((a, i) => (
          <ArticleCard key={i} article={a} />
        ))}
      </div>
    );
  }

  return null;
}
