export interface DiscountCardData {
  code?: string;
  valid?: boolean;
  type?: string;
  value?: string;
  description?: string;
  minimumPurchase?: string;
  expiresAt?: string;
  applied?: boolean;
  newTotal?: string;
  savings?: string;
  currencyCode?: string;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export function DiscountCard({ data }: { data: DiscountCardData }) {
  const isValid = data.valid !== false;

  return (
    <div className="p-3 bg-card border border-border/50 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        <h4 className="font-semibold text-sm">
          {data.applied ? "Discount Applied" : "Discount Code"}
        </h4>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${isValid ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"}`}>
          {data.applied ? "Applied" : isValid ? "Valid" : "Invalid"}
        </span>
      </div>

      <div className="space-y-1 text-xs">
        {data.code && (
          <p className="text-foreground">
            Code: <span className="font-mono font-medium bg-muted px-1.5 py-0.5 rounded">{data.code}</span>
          </p>
        )}
        {data.description && (
          <p className="text-muted-foreground">{data.description}</p>
        )}
        {data.value && (
          <p className="text-foreground font-medium">
            {data.type === "percentage" ? `${data.value}% off` : data.type === "fixed" ? `$${data.value} off` : data.value}
          </p>
        )}
        {data.savings && (
          <p className="text-green-600 dark:text-green-400 font-medium">
            You save: ${data.savings}
          </p>
        )}
        {data.newTotal && (
          <p className="text-foreground">
            New total: <span className="font-bold">${data.newTotal}</span>
          </p>
        )}
      </div>

      {(data.minimumPurchase || data.expiresAt) && (
        <div className="mt-2 pt-2 border-t border-border/30 space-y-0.5">
          {data.minimumPurchase && (
            <p className="text-[10px] text-muted-foreground">Min. purchase: ${data.minimumPurchase}</p>
          )}
          {data.expiresAt && (
            <p className="text-[10px] text-muted-foreground">Expires: {formatDate(data.expiresAt)}</p>
          )}
        </div>
      )}
    </div>
  );
}
