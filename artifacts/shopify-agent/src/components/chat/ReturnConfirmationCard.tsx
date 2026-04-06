export interface ReturnConfirmationData {
  returnId?: string;
  orderId?: string;
  status?: string;
  reason?: string;
  createdAt?: string;
  items?: Array<{ title?: string; quantity?: number }>;
}

function statusBadge(status?: string): { label: string; className: string } {
  switch (status?.toLowerCase()) {
    case "approved":
      return { label: "Approved", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" };
    case "rejected":
    case "denied":
      return { label: "Rejected", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" };
    case "completed":
      return { label: "Completed", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" };
    default:
      return { label: "Requested", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" };
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export function ReturnConfirmationCard({ returnData }: { returnData: ReturnConfirmationData }) {
  const badge = statusBadge(returnData.status);

  return (
    <div className="p-3 bg-card border border-border/50 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
        <h4 className="font-semibold text-sm">Return Request</h4>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <div className="space-y-1 text-xs">
        {returnData.returnId && (
          <p className="text-muted-foreground">
            Return ID: <span className="text-foreground font-mono">{returnData.returnId}</span>
          </p>
        )}
        {returnData.orderId && (
          <p className="text-muted-foreground">
            Order: <span className="text-foreground">{returnData.orderId}</span>
          </p>
        )}
        {returnData.reason && (
          <p className="text-muted-foreground">
            Reason: <span className="text-foreground">{returnData.reason}</span>
          </p>
        )}
        {returnData.createdAt && (
          <p className="text-muted-foreground">
            Submitted: <span className="text-foreground">{formatDate(returnData.createdAt)}</span>
          </p>
        )}
      </div>

      {returnData.items && returnData.items.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground mb-1">Items being returned:</p>
          {returnData.items.map((item, i) => (
            <p key={i} className="text-xs">
              {item.title} <span className="text-muted-foreground">x{item.quantity || 1}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
