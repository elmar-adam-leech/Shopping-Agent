export interface LoyaltyBalanceData {
  balance?: number;
  tier?: string;
  pointsValue?: string;
  currencyCode?: string;
  nextTier?: string;
  pointsToNextTier?: number;
}

function tierColor(tier?: string): string {
  switch (tier?.toLowerCase()) {
    case "gold":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "platinum":
    case "diamond":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    case "silver":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400";
    default:
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  }
}

export function LoyaltyBalanceCard({ data }: { data: LoyaltyBalanceData }) {
  return (
    <div className="p-3 bg-card border border-border/50 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        <h4 className="font-semibold text-sm">Loyalty Balance</h4>
        {data.tier && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tierColor(data.tier)}`}>
            {data.tier}
          </span>
        )}
      </div>

      <div className="space-y-1 text-xs">
        {data.balance !== undefined && (
          <p className="text-foreground">
            <span className="text-lg font-bold">{data.balance.toLocaleString()}</span>
            <span className="text-muted-foreground ml-1">points</span>
          </p>
        )}
        {data.pointsValue && (
          <p className="text-muted-foreground">
            Value: <span className="text-foreground font-medium">{data.currencyCode === "USD" ? "$" : data.currencyCode === "EUR" ? "€" : ""}{data.pointsValue}</span>
          </p>
        )}
      </div>

      {data.nextTier && data.pointsToNextTier !== undefined && (
        <div className="mt-2 pt-2 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground">
            {data.pointsToNextTier.toLocaleString()} more points to reach <span className="font-medium">{data.nextTier}</span>
          </p>
        </div>
      )}
    </div>
  );
}
