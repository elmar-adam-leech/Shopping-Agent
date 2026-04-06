import { useState, useCallback } from "react";
import { useRoute } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetEnhancedAnalytics,
  getGetEnhancedAnalyticsQueryKey,
  useGetDailyQueries,
  getGetDailyQueriesQueryKey,
} from "@workspace/api-client-react";
import {
  MessageSquare,
  Users,
  Loader2,
  DollarSign,
  Package,
  Wrench,
  AlertTriangle,
  X,
  CalendarDays,
  Download,
  ChevronDown,
} from "lucide-react";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { LastUpdated } from "@/components/ui/last-updated";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  BarChart,
  Bar,
  Cell,
} from "recharts";

type PresetRange = 7 | 30 | 90;
type DateRangeMode = { type: "preset"; days: PresetRange } | { type: "custom"; startDate: string; endDate: string };
type ExportSection = "overview" | "daily_chats" | "top_queries" | "tool_usage" | "conversion_funnel" | "top_products";

function formatDateForInput(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function AnalyticsPage() {
  const [, params] = useRoute("/:storeDomain/analytics");
  const storeDomain = params?.storeDomain || "";
  const [dateRange, setDateRange] = useState<DateRangeMode>({ type: "preset", days: 7 });
  const [drillDownDate, setDrillDownDate] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExport = useCallback(async (sections?: ExportSection[]) => {
    const label = sections ? sections.join(",") : "all";
    setExporting(label);
    setShowExportMenu(false);
    try {
      const params = new URLSearchParams();
      if (dateRange.type === "preset") {
        params.set("days", String(dateRange.days));
      } else {
        params.set("startDate", dateRange.startDate);
        params.set("endDate", dateRange.endDate);
      }
      if (sections) {
        params.set("sections", sections.join(","));
      }
      const response = await fetch(`/api/stores/${storeDomain}/analytics/export?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+?)"/);
      a.download = filenameMatch?.[1] || `analytics-export.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(null);
    }
  }, [storeDomain, dateRange]);

  const queryParams =
    dateRange.type === "preset"
      ? { days: dateRange.days }
      : { days: 7, startDate: dateRange.startDate, endDate: dateRange.endDate };

  const { data, isLoading, dataUpdatedAt } = useGetEnhancedAnalytics(storeDomain, queryParams, {
    query: {
      queryKey: getGetEnhancedAnalyticsQueryKey(storeDomain, queryParams),
      staleTime: 30_000,
      refetchInterval: 30_000,
    },
  });

  const { data: dailyQueryData, isLoading: isDrillDownLoading } = useGetDailyQueries(
    storeDomain,
    { date: drillDownDate ?? "" },
    {
      query: {
        queryKey: getGetDailyQueriesQueryKey(storeDomain, { date: drillDownDate ?? "" }),
        enabled: !!drillDownDate,
      },
    }
  );

  const handleChartClick = useCallback((chartData: { activePayload?: Array<{ payload: { date: string } }> }) => {
    if (chartData?.activePayload?.[0]?.payload?.date) {
      setDrillDownDate(chartData.activePayload[0].payload.date);
    }
  }, []);

  if (isLoading) {
    return (
      <AppLayout storeDomain={storeDomain}>
        <LoadingOverlay loadingText="Loading analytics..." />
      </AppLayout>
    );
  }

  const funnelData = data?.conversionFunnel
    ? [
        { name: "Chats", value: data.conversionFunnel.totalChats, color: "hsl(var(--primary))" },
        { name: "Carts", value: data.conversionFunnel.cartCreated, color: "hsl(221, 83%, 53%)" },
        { name: "Checkouts", value: data.conversionFunnel.checkoutStarted, color: "hsl(262, 83%, 58%)" },
        { name: "Purchases", value: data.conversionFunnel.checkoutCompleted, color: "hsl(142, 71%, 45%)" },
      ]
    : [];

  const toolData = (data?.toolUsage ?? []).map((t) => ({
    name: t.toolName.replace(/_/g, " "),
    count: t.count,
  }));

  const rangeLabel =
    dateRange.type === "preset" ? `Last ${dateRange.days} Days` : `${dateRange.startDate} to ${dateRange.endDate}`;

  return (
    <AppLayout storeDomain={storeDomain}>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold mb-1">Analytics</h1>
            <div className="flex items-center gap-3">
              <p className="text-muted-foreground text-lg">
                Insights from your AI Shopping Agent.
              </p>
              {dataUpdatedAt > 0 && <LastUpdated dataUpdatedAt={dataUpdatedAt} />}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <ExportButton
              exporting={exporting}
              showMenu={showExportMenu}
              onToggleMenu={() => setShowExportMenu(!showExportMenu)}
              onExport={handleExport}
              onClose={() => setShowExportMenu(false)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="Total Conversations"
            value={data?.totalChats ?? 0}
            icon={<MessageSquare className="w-5 h-5 text-primary" />}
          />
          <StatCard
            title="Active Sessions"
            value={data?.totalSessions ?? 0}
            icon={<Users className="w-5 h-5 text-emerald-500" />}
          />
          <StatCard
            title="Abandoned Carts"
            value={data?.abandonedCarts ?? 0}
            icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
          />
          <StatCard
            title="Revenue from AI"
            value={`$${(data?.estimatedRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<DollarSign className="w-5 h-5 text-green-500" />}
            highlight
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold font-display text-lg mb-6">
              Conversion Funnel
            </h3>
            <div className="h-[260px] w-full">
              {funnelData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} layout="vertical" barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 13 }} width={90} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid hsl(var(--border))",
                        backgroundColor: "hsl(var(--card))",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                      {funnelData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No conversion data yet." />
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex flex-col">
            <h3 className="font-bold font-display text-lg mb-6">
              <Wrench className="inline w-4 h-4 mr-2 text-muted-foreground" />
              Tool Usage
            </h3>
            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              {toolData.length > 0 ? (
                toolData.map((t, i) => (
                  <ToolBar key={i} name={t.name} count={t.count} max={toolData[0].count} />
                ))
              ) : (
                <EmptyState message="No tool usage recorded yet." />
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold font-display text-lg mb-2">
              Daily Activity ({rangeLabel})
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Click on a day to see that day's top queries
            </p>
            <div className="h-[300px] w-full">
              {(data?.dailyChats?.length ?? 0) > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data?.dailyChats || []}
                    onClick={handleChartClick}
                    style={{ cursor: "pointer" }}
                  >
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      dx={-10}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid hsl(var(--border))",
                        backgroundColor: "hsl(var(--card))",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorCount)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No activity data for this period." />
              )}
            </div>
          </div>

          <div className="lg:col-span-1 bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex flex-col">
            <h3 className="font-bold font-display text-lg mb-6">
              <Package className="inline w-4 h-4 mr-2 text-muted-foreground" />
              Top Recommended Products
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {data?.topProducts && data.topProducts.length > 0 ? (
                data.topProducts.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground w-5 text-right shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-sm font-medium leading-snug truncate">
                        {item.productHandle.replace(/-/g, " ")}
                      </p>
                    </div>
                    <div className="px-2 py-1 rounded-md bg-background border border-border/50 text-xs font-bold text-muted-foreground whitespace-nowrap shrink-0">
                      {item.count}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No product recommendations yet." />
              )}
            </div>
          </div>
        </div>

        {drillDownDate && (
          <DrillDownPanel
            date={drillDownDate}
            data={dailyQueryData}
            isLoading={isDrillDownLoading}
            onClose={() => setDrillDownDate(null)}
          />
        )}

        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold font-display text-lg mb-6">Top Customer Queries</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">#</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Query</th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Count</th>
                </tr>
              </thead>
              <tbody>
                {data?.topQueries && data.topQueries.length > 0 ? (
                  data.topQueries.map((item, i) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                      <td className="py-3 px-4 text-muted-foreground font-medium">{i + 1}</td>
                      <td className="py-3 px-4 font-medium">{item.query}</td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-bold">
                          {item.count}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3}>
                      <EmptyState message="No queries recorded yet. Start chatting to see insights." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function DateRangePicker({ value, onChange }: { value: DateRangeMode; onChange: (v: DateRangeMode) => void }) {
  const presets: { label: string; days: PresetRange }[] = [
    { label: "7 days", days: 7 },
    { label: "30 days", days: 30 },
    { label: "90 days", days: 90 },
  ];
  const [showCustom, setShowCustom] = useState(false);
  const [startInput, setStartInput] = useState(formatDateForInput(new Date(Date.now() - 30 * 86400000)));
  const [endInput, setEndInput] = useState(formatDateForInput(new Date()));

  const isCustomActive = value.type === "custom";

  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 w-full sm:w-auto">
      <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1 overflow-x-auto w-full sm:w-auto">
        {presets.map((p) => (
          <button
            key={p.days}
            onClick={() => {
              onChange({ type: "preset", days: p.days });
              setShowCustom(false);
            }}
            className={`px-3 sm:px-4 py-2.5 min-h-11 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              value.type === "preset" && value.days === p.days
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`px-3 sm:px-4 py-2.5 min-h-11 rounded-lg text-sm font-medium transition-all flex items-center gap-1 whitespace-nowrap ${
            isCustomActive
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Custom
        </button>
      </div>
      {showCustom && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-secondary/50 rounded-xl p-2 w-full sm:w-auto">
          <input
            type="date"
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
            className="px-3 py-2.5 min-h-11 rounded-lg bg-background border border-border/50 text-sm w-full sm:w-auto"
          />
          <span className="text-muted-foreground text-sm text-center">to</span>
          <input
            type="date"
            value={endInput}
            onChange={(e) => setEndInput(e.target.value)}
            className="px-3 py-2.5 min-h-11 rounded-lg bg-background border border-border/50 text-sm w-full sm:w-auto"
          />
          <button
            onClick={() => {
              if (startInput && endInput) {
                onChange({ type: "custom", startDate: startInput, endDate: endInput });
              }
            }}
            className="px-4 py-2.5 min-h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

function ExportButton({
  exporting,
  showMenu,
  onToggleMenu,
  onExport,
  onClose,
}: {
  exporting: string | null;
  showMenu: boolean;
  onToggleMenu: () => void;
  onExport: (sections?: ExportSection[]) => void;
  onClose: () => void;
}) {
  const sectionOptions: { label: string; value: ExportSection }[] = [
    { label: "Overview Metrics", value: "overview" },
    { label: "Daily Activity", value: "daily_chats" },
    { label: "Top Queries", value: "top_queries" },
    { label: "Tool Usage", value: "tool_usage" },
    { label: "Conversion Funnel", value: "conversion_funnel" },
    { label: "Top Products", value: "top_products" },
  ];

  return (
    <div className="relative">
      <div className="flex items-center">
        <button
          onClick={() => onExport()}
          disabled={!!exporting}
          className="flex items-center gap-2 px-4 py-2.5 min-h-11 rounded-l-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">{exporting ? "Exporting..." : "Export CSV"}</span>
          <span className="sm:hidden">{exporting ? "..." : "CSV"}</span>
        </button>
        <button
          onClick={onToggleMenu}
          disabled={!!exporting}
          className="flex items-center px-3 py-2.5 min-h-11 rounded-r-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors border-l border-primary-foreground/20 disabled:opacity-60"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border/50 rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="p-2">
              <button
                onClick={() => onExport()}
                className="w-full text-left px-3 py-2.5 min-h-11 rounded-lg text-sm font-medium hover:bg-secondary/50 transition-colors flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Download All
              </button>
              <div className="h-px bg-border/50 my-1" />
              {sectionOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onExport([opt.value])}
                  className="w-full text-left px-3 py-2.5 min-h-11 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DrillDownPanel({
  date,
  data,
  isLoading,
  onClose,
}: {
  date: string;
  data?: { date: string; queries: Array<{ query: string; count: number }>; totalEvents: number } | null;
  isLoading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="bg-card border border-primary/20 rounded-3xl p-6 shadow-md animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold font-display text-lg">
            Drill-Down: {date}
          </h3>
          {data && (
            <p className="text-sm text-muted-foreground">
              {data.totalEvents} total events on this day
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-secondary/50 transition-colors"
          aria-label="Close drill-down"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : data?.queries && data.queries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 px-4 font-semibold text-muted-foreground">#</th>
                <th className="text-left py-2 px-4 font-semibold text-muted-foreground">Query</th>
                <th className="text-right py-2 px-4 font-semibold text-muted-foreground">Count</th>
              </tr>
            </thead>
            <tbody>
              {data.queries.map((q, i) => (
                <tr key={i} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                  <td className="py-2 px-4 text-muted-foreground font-medium">{i + 1}</td>
                  <td className="py-2 px-4 font-medium">{q.query}</td>
                  <td className="py-2 px-4 text-right">
                    <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-bold">
                      {q.count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="No queries recorded for this day." />
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  highlight,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-card border rounded-3xl p-6 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow ${
        highlight ? "border-green-500/30" : "border-border/50"
      }`}
    >
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="p-3 bg-secondary/50 rounded-xl">{icon}</div>
      </div>
      <div className="relative z-10">
        <h4 className="text-muted-foreground font-medium text-sm mb-1">{title}</h4>
        <div className="text-3xl font-display font-bold text-foreground">{value}</div>
      </div>
    </div>
  );
}

function ToolBar({ name, count, max }: { name: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium capitalize truncate">{name}</span>
        <span className="text-muted-foreground font-bold text-xs">{count}</span>
      </div>
      <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[100px] text-muted-foreground text-sm">
      {message}
    </div>
  );
}
