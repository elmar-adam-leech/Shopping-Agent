import { ProductCard, type ProductCardData } from "./ProductCard";
import { ProductCarousel } from "./ProductCarousel";
import { ComparisonTable } from "./ComparisonTable";
import { CartSummaryCard } from "./CartSummaryCard";
import { CartEditPreviewCard, type CartEditPreviewData } from "./CartEditPreviewCard";
import { CollectionCard, type CollectionCardData } from "./CollectionCard";
import { ArticleCard, type BlogArticleData } from "./ArticleCard";
import { ArticleCarousel } from "./ArticleCarousel";
import { OrderCard, type OrderCardData } from "./OrderCard";
import { OrderStatusCard, type OrderStatusCardData, type FulfillmentData } from "./OrderStatusCard";
import { ReturnConfirmationCard, type ReturnConfirmationData } from "./ReturnConfirmationCard";
import { MetaobjectCard, type MetaobjectData } from "./MetaobjectCard";
import { LoyaltyBalanceCard, type LoyaltyBalanceData } from "./LoyaltyBalanceCard";
import { DiscountCard, type DiscountCardData } from "./DiscountCard";
import { SubscriptionCadenceCard, type SubscriptionCadenceData, type CadenceOption } from "./SubscriptionCadenceCard";
import { PreOrderCard, type PreOrderData } from "./PreOrderCard";
import { EscalationCard, type EscalationData } from "./EscalationCard";
import { WishlistCard, type WishlistItemData } from "./WishlistCard";
import { CrossSellCard } from "./CrossSellCard";

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

  if (toolName === 'propose_cart_edit' && data._cartEditPreview) {
    return <CartEditPreviewCard data={data as unknown as CartEditPreviewData} />;
  }

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

  if (toolName === 'recommend_products' || toolName === 'get_cross_sell_products') {
    const products: ProductCardData[] = [];
    if (data.products && Array.isArray((data.products as Record<string, unknown>).edges)) {
      for (const edge of (data.products as { edges: Array<{ node: ProductCardData }> }).edges) {
        products.push(edge.node);
      }
    }

    if (products.length === 0) return null;

    const heading = typeof data._source === 'string' && data._source === 'cross_sell'
      ? (typeof data._heading === 'string' ? data._heading : 'You might also like')
      : 'Recommended for You';

    return <CrossSellCard products={products} heading={heading} />;
  }

  if (toolName === 'save_to_wishlist' || toolName === 'get_wishlist' || toolName === 'remove_from_wishlist') {
    const items = (Array.isArray(data.items) ? data.items : []) as WishlistItemData[];
    const action = typeof data._action === 'string' ? data._action as 'saved' | 'removed' | 'list' : 'list';
    const savedItem = data.savedItem ? data.savedItem as WishlistItemData : undefined;
    const removedTitle = typeof data.removedTitle === 'string' ? data.removedTitle : undefined;

    return (
      <WishlistCard
        items={items}
        action={action}
        savedItem={savedItem}
        removedTitle={removedTitle}
      />
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

    if (articles.length >= 3) {
      return <ArticleCarousel articles={articles.slice(0, 12)} />;
    }

    return (
      <div className="grid gap-2 mt-2">
        {articles.slice(0, 6).map((a, i) => (
          <ArticleCard key={i} article={a} />
        ))}
      </div>
    );
  }

  if (toolName === 'get_store_content' || toolName === 'get_metaobjects') {
    const metaobjects: MetaobjectData[] = [];
    if (data.metaobjects && Array.isArray((data.metaobjects as Record<string, unknown>).edges)) {
      for (const edge of (data.metaobjects as { edges: Array<{ node: MetaobjectData }> }).edges) {
        metaobjects.push(edge.node);
      }
    }

    if (metaobjects.length === 0) return null;

    return (
      <div className="grid gap-2 mt-2">
        {metaobjects.slice(0, 10).map((m, i) => (
          <MetaobjectCard key={i} data={m} />
        ))}
      </div>
    );
  }

  if (toolName === 'get_loyalty_balance') {
    const loyaltyData: LoyaltyBalanceData = {
      balance: typeof data.balance === 'number' ? data.balance : typeof data.points === 'number' ? data.points : undefined,
      tier: str(data.tier || data.tierStatus || data.tier_status),
      pointsValue: str(data.pointsValue || data.points_value || (data.value as Record<string, unknown>)?.amount),
      currencyCode: str(data.currencyCode || data.currency),
      nextTier: str(data.nextTier || data.next_tier),
      pointsToNextTier: typeof data.pointsToNextTier === 'number' ? data.pointsToNextTier : typeof data.points_to_next_tier === 'number' ? data.points_to_next_tier as number : undefined,
    };
    if (loyaltyData.balance === undefined) return null;
    return <div className="mt-2"><LoyaltyBalanceCard data={loyaltyData} /></div>;
  }

  if (toolName === 'apply_discount' || toolName === 'validate_discount_code') {
    const discountData: DiscountCardData = {
      code: str(data.code || data.discountCode || data.discount_code),
      valid: data.valid !== false && data.error === undefined,
      type: str(data.type || data.discountType || data.discount_type),
      value: str(data.value || data.amount || data.discountValue || data.discount_value),
      description: str(data.description || data.summary),
      minimumPurchase: str(data.minimumPurchase || data.minimum_purchase || data.minimumOrderAmount),
      expiresAt: str(data.expiresAt || data.expires_at || data.expiry),
      applied: toolName === 'apply_discount' && data.error === undefined,
      newTotal: str(data.newTotal || data.new_total || data.updatedTotal || data.updated_total),
      savings: str(data.savings || data.savedAmount || data.saved_amount),
      currencyCode: str(data.currencyCode || data.currency),
    };
    return <div className="mt-2"><DiscountCard data={discountData} /></div>;
  }

  if (toolName === 'list_subscription_options' || toolName === 'set_subscription_cadence') {
    const options: CadenceOption[] = [];
    const rawOptions = data.options || data.cadenceOptions || data.cadence_options || data.plans;
    if (Array.isArray(rawOptions)) {
      for (const opt of rawOptions as Record<string, unknown>[]) {
        options.push({
          cadence: String(opt.cadence || opt.interval || opt.frequency || ""),
          label: str(opt.label || opt.name),
          price: str(opt.price || (opt.priceAmount as Record<string, unknown>)?.amount),
          savings: str(opt.savings || opt.discount),
          currencyCode: str(opt.currencyCode || opt.currency),
        });
      }
    }
    const subData: SubscriptionCadenceData = {
      productName: str(data.productName || data.product_name || data.productTitle),
      productId: str(data.productId || data.product_id),
      options: options.length > 0 ? options : undefined,
      selectedCadence: str(data.selectedCadence || data.selected_cadence || data.cadence || data.interval),
      subscriptionId: str(data.subscriptionId || data.subscription_id),
      confirmed: toolName === 'set_subscription_cadence' && data.error === undefined,
    };
    return <div className="mt-2"><SubscriptionCadenceCard data={subData} /></div>;
  }

  if (toolName === 'check_preorder_availability' || toolName === 'create_preorder') {
    const preorderData: PreOrderData = {
      productName: str(data.productName || data.product_name || data.productTitle),
      productId: str(data.productId || data.product_id),
      available: data.available !== false,
      estimatedDate: str(data.estimatedDate || data.estimated_date || data.availableDate || data.available_date || data.estimatedAvailability),
      deposit: str(data.deposit || data.depositAmount || data.deposit_amount),
      depositPercentage: str(data.depositPercentage || data.deposit_percentage),
      fullPrice: str(data.fullPrice || data.full_price || data.price || (data.totalPrice as Record<string, unknown>)?.amount),
      currencyCode: str(data.currencyCode || data.currency),
      terms: str(data.terms || data.preorderTerms || data.preorder_terms),
      cancellable: typeof data.cancellable === 'boolean' ? data.cancellable : typeof data.cancelable === 'boolean' ? data.cancelable : undefined,
      confirmed: toolName === 'create_preorder' && data.error === undefined,
      preorderId: str(data.preorderId || data.preorder_id || data.id),
    };
    return <div className="mt-2"><PreOrderCard data={preorderData} /></div>;
  }

  if (data._escalation === true || data.requires_escalation === true) {
    const escalationData: EscalationData = {
      reason: str(data.escalation_reason || data.reason),
      message: str(data._escalation_message || data.message),
      contactEmail: str(data.contact_email || data.contactEmail),
      contactPhone: str(data.contact_phone || data.contactPhone),
      contactUrl: str(data.contact_url || data.contactUrl),
    };
    return <div className="mt-2"><EscalationCard data={escalationData} /></div>;
  }

  return null;
}
