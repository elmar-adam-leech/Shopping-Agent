export interface CadenceOption {
  cadence: string;
  label?: string;
  price?: string;
  savings?: string;
  currencyCode?: string;
}

export interface SubscriptionCadenceData {
  productName?: string;
  productId?: string;
  options?: CadenceOption[];
  selectedCadence?: string;
  subscriptionId?: string;
  confirmed?: boolean;
}

const CADENCE_LABELS: Record<string, string> = {
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
  quarterly: "Every 3 months",
};

function cadenceLabel(cadence: string): string {
  return CADENCE_LABELS[cadence.toLowerCase()] || cadence;
}

export function SubscriptionCadenceCard({ data }: { data: SubscriptionCadenceData }) {
  return (
    <div className="p-3 bg-card border border-border/50 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <h4 className="font-semibold text-sm">
          {data.confirmed ? "Subscription Confirmed" : "Subscription Options"}
        </h4>
        {data.confirmed && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            Active
          </span>
        )}
      </div>

      {data.productName && (
        <p className="text-xs text-muted-foreground mb-2">{data.productName}</p>
      )}

      {data.options && data.options.length > 0 && (
        <div className="space-y-1.5">
          {data.options.map((opt, i) => {
            const isSelected = data.selectedCadence === opt.cadence;
            return (
              <div
                key={i}
                className={`flex items-center justify-between p-2 rounded-lg text-xs ${isSelected ? "bg-primary/10 border border-primary/30" : "bg-muted/50"}`}
              >
                <div>
                  <span className={`font-medium ${isSelected ? "text-primary" : ""}`}>
                    {opt.label || cadenceLabel(opt.cadence)}
                  </span>
                  {opt.savings && (
                    <span className="ml-1.5 text-green-600 dark:text-green-400 text-[10px]">
                      Save {opt.savings}
                    </span>
                  )}
                </div>
                {opt.price && (
                  <span className="text-muted-foreground">${opt.price}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {data.selectedCadence && !data.options?.length && (
        <p className="text-xs text-foreground">
          Delivery: <span className="font-medium">{cadenceLabel(data.selectedCadence)}</span>
        </p>
      )}
    </div>
  );
}
