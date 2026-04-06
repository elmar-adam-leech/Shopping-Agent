export interface FulfillmentData {
  status?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  estimatedDelivery?: string;
  updatedAt?: string;
}

export interface OrderStatusCardData {
  orderId?: string;
  orderNumber?: string;
  status?: string;
  fulfillmentStatus?: string;
  fulfillments?: FulfillmentData[];
  trackingUrl?: string;
  createdAt?: string;
  totalPrice?: string;
  currencyCode?: string;
}

const STEPS = ["ordered", "shipped", "in_transit", "delivered"] as const;
type StepKey = (typeof STEPS)[number];

function resolveStep(fulfillmentStatus?: string, fulfillments?: FulfillmentData[]): number {
  if (!fulfillmentStatus && (!fulfillments || fulfillments.length === 0)) return 0;

  const topStatus = fulfillments?.[0]?.status?.toLowerCase() || fulfillmentStatus?.toLowerCase() || "";

  if (topStatus.includes("deliver") && !topStatus.includes("attempt") && !topStatus.includes("out")) return 3;
  if (topStatus.includes("out_for") || topStatus.includes("out for")) return 2;
  if (topStatus.includes("transit") || topStatus.includes("shipped")) return 2;
  if (topStatus === "fulfilled" || topStatus === "in_transit") return 2;
  if (topStatus === "partially_fulfilled") return 1;
  return 0;
}

const stepLabels: Record<StepKey, string> = {
  ordered: "Ordered",
  shipped: "Shipped",
  in_transit: "In Transit",
  delivered: "Delivered",
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export function OrderStatusCard({ order }: { order: OrderStatusCardData }) {
  const currentStep = resolveStep(order.fulfillmentStatus, order.fulfillments);
  const isCancelled = order.status?.toLowerCase() === "cancelled";
  const topFulfillment = order.fulfillments?.[0];

  return (
    <div className="p-3 bg-card border border-border/50 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-sm">
          Order {order.orderNumber || order.orderId || ""}
        </h4>
        {order.trackingUrl && (
          <a
            href={order.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            Track Package
          </a>
        )}
      </div>

      {isCancelled ? (
        <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="text-xs font-medium text-red-700 dark:text-red-400">Order Cancelled</span>
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            {STEPS.map((step, i) => (
              <div key={step} className="flex flex-col items-center flex-1">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold z-10 ${
                    i <= currentStep
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < currentStep ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className={`text-[10px] mt-1 ${i <= currentStep ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {stepLabels[step]}
                </span>
              </div>
            ))}
          </div>

          <div className="absolute top-2.5 left-[12%] right-[12%] h-0.5 -translate-y-1/2">
            <div className="w-full h-full bg-muted rounded-full" />
            <div
              className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {topFulfillment && (
        <div className="mt-3 pt-2 border-t border-border/30 space-y-1">
          {topFulfillment.carrier && (
            <p className="text-xs text-muted-foreground">
              Carrier: <span className="text-foreground">{topFulfillment.carrier}</span>
            </p>
          )}
          {topFulfillment.trackingNumber && (
            <p className="text-xs text-muted-foreground">
              Tracking: <span className="text-foreground font-mono">{topFulfillment.trackingNumber}</span>
            </p>
          )}
          {topFulfillment.estimatedDelivery && (
            <p className="text-xs text-muted-foreground">
              Est. Delivery: <span className="text-foreground">{formatDate(topFulfillment.estimatedDelivery)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
