export interface OrderCardItem {
  title?: string;
  quantity?: number;
  price?: string;
  currencyCode?: string;
  imageUrl?: string;
  variantTitle?: string;
}

export interface OrderCardData {
  orderId?: string;
  orderNumber?: string;
  status?: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
  createdAt?: string;
  totalPrice?: string;
  currencyCode?: string;
  items?: OrderCardItem[];
  trackingUrl?: string;
  returnEligible?: boolean;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount?: string, currency?: string): string {
  if (!amount) return "";
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : (currency || "") + " ";
  return `${sym}${amount}`;
}

function statusColor(status?: string): string {
  switch (status?.toLowerCase()) {
    case "fulfilled":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "partially_fulfilled":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "unfulfilled":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    case "cancelled":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function statusLabel(status?: string): string {
  switch (status?.toLowerCase()) {
    case "fulfilled": return "Fulfilled";
    case "partially_fulfilled": return "Partially Fulfilled";
    case "unfulfilled": return "Processing";
    case "cancelled": return "Cancelled";
    default: return status || "Unknown";
  }
}

export function OrderCard({ order }: { order: OrderCardData }) {
  return (
    <div className="p-3 bg-card border border-border/50 rounded-xl hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">
              Order {order.orderNumber || order.orderId || ""}
            </h4>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColor(order.fulfillmentStatus || order.status)}`}>
              {statusLabel(order.fulfillmentStatus || order.status)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDate(order.createdAt)}
            {order.totalPrice && (
              <span className="ml-2 font-medium">{formatCurrency(order.totalPrice, order.currencyCode)}</span>
            )}
          </p>
        </div>
        {order.trackingUrl && (
          <a
            href={order.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex-shrink-0"
          >
            Track
          </a>
        )}
      </div>

      {order.items && order.items.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {order.items.slice(0, 4).map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt={item.title || "Item"}
                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate">{item.title}</p>
                {item.variantTitle && (
                  <p className="text-[10px] text-muted-foreground">{item.variantTitle}</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                x{item.quantity || 1}
              </span>
            </div>
          ))}
          {order.items.length > 4 && (
            <p className="text-[10px] text-muted-foreground">+{order.items.length - 4} more items</p>
          )}
        </div>
      )}

      {order.returnEligible && (
        <p className="text-[10px] text-muted-foreground mt-2 border-t border-border/30 pt-1.5">
          Eligible for return
        </p>
      )}
    </div>
  );
}
