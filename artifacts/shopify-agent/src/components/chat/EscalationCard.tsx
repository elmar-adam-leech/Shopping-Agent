export interface EscalationData {
  reason?: string;
  message?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactUrl?: string;
}

export function EscalationCard({ data }: { data: EscalationData }) {
  return (
    <div className="p-3 bg-card border border-yellow-300/50 dark:border-yellow-700/50 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <h4 className="font-semibold text-sm text-yellow-800 dark:text-yellow-300">Support Needed</h4>
      </div>

      <div className="space-y-1.5 text-xs">
        {data.reason && (
          <p className="text-foreground">{data.reason}</p>
        )}
        {data.message && !data.reason && (
          <p className="text-foreground">{data.message}</p>
        )}
      </div>

      {(data.contactEmail || data.contactPhone || data.contactUrl) && (
        <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground">Contact Support:</p>
          {data.contactEmail && (
            <p className="text-xs">
              <a href={`mailto:${data.contactEmail}`} className="text-primary hover:underline">{data.contactEmail}</a>
            </p>
          )}
          {data.contactPhone && (
            <p className="text-xs">
              <a href={`tel:${data.contactPhone}`} className="text-primary hover:underline">{data.contactPhone}</a>
            </p>
          )}
          {data.contactUrl && (
            <p className="text-xs">
              <a href={data.contactUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Support Page</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
