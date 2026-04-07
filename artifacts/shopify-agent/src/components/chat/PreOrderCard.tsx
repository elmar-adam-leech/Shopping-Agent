export interface PreOrderData {
  productName?: string;
  productId?: string;
  available?: boolean;
  estimatedDate?: string;
  deposit?: string;
  depositPercentage?: string;
  fullPrice?: string;
  currencyCode?: string;
  terms?: string;
  cancellable?: boolean;
  confirmed?: boolean;
  preorderId?: string;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export function PreOrderCard({ data }: { data: PreOrderData }) {
  return (
    <div className="p-3 bg-card border border-border/50 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h4 className="font-semibold text-sm">
          {data.confirmed ? "Pre-Order Confirmed" : "Pre-Order Available"}
        </h4>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${data.confirmed ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : data.available !== false ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"}`}>
          {data.confirmed ? "Confirmed" : data.available !== false ? "Available" : "Unavailable"}
        </span>
      </div>

      {data.productName && (
        <p className="text-xs font-medium mb-1.5">{data.productName}</p>
      )}

      <div className="space-y-1 text-xs">
        {data.estimatedDate && (
          <p className="text-muted-foreground">
            Estimated availability: <span className="text-foreground font-medium">{formatDate(data.estimatedDate)}</span>
          </p>
        )}
        {data.fullPrice && (
          <p className="text-muted-foreground">
            Price: <span className="text-foreground font-medium">${data.fullPrice}</span>
          </p>
        )}
        {data.deposit && (
          <p className="text-muted-foreground">
            Deposit required: <span className="text-foreground font-medium">${data.deposit}</span>
            {data.depositPercentage && <span className="text-muted-foreground"> ({data.depositPercentage}%)</span>}
          </p>
        )}
        {data.preorderId && (
          <p className="text-muted-foreground">
            Pre-order ID: <span className="text-foreground font-mono">{data.preorderId}</span>
          </p>
        )}
      </div>

      {(data.terms || data.cancellable !== undefined) && (
        <div className="mt-2 pt-2 border-t border-border/30 space-y-0.5">
          {data.terms && (
            <p className="text-[10px] text-muted-foreground">{data.terms}</p>
          )}
          {data.cancellable !== undefined && (
            <p className="text-[10px] text-muted-foreground">
              {data.cancellable ? "Free cancellation before shipment" : "Non-cancellable after confirmation"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
