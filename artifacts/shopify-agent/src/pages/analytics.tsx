import { useRoute } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetAnalytics } from "@workspace/api-client-react";
import { MessageSquare, Users, TrendingUp, Loader2 } from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

export default function AnalyticsPage() {
  const [, params] = useRoute("/:storeDomain/analytics");
  const storeDomain = params?.storeDomain || "";
  
  const { data, isLoading } = useGetAnalytics(storeDomain, { days: 7 });

  const emptyChartData = [
    { date: 'Mon', count: 0 },
    { date: 'Tue', count: 0 },
    { date: 'Wed', count: 0 },
    { date: 'Thu', count: 0 },
    { date: 'Fri', count: 0 },
    { date: 'Sat', count: 0 },
    { date: 'Sun', count: 0 },
  ];

  if (isLoading) {
    return (
      <AppLayout storeDomain={storeDomain}>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout storeDomain={storeDomain}>
      <div className="max-w-6xl mx-auto p-6 lg:p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Analytics</h1>
          <p className="text-muted-foreground text-lg">Insights from your AI Shopping Agent.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            title="Total Conversations" 
            value={data?.totalChats ?? 0} 
            trend="+0%" 
            icon={<MessageSquare className="w-5 h-5 text-primary" />} 
          />
          <StatCard 
            title="Active Sessions" 
            value={data?.totalSessions ?? 0} 
            trend="+0%" 
            icon={<Users className="w-5 h-5 text-emerald-500" />} 
          />
          <StatCard 
            title="Conversion Lift" 
            value="--" 
            trend="--" 
            icon={<TrendingUp className="w-5 h-5 text-amber-500" />} 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold font-display text-lg mb-6">Daily Chat Volume (Last 7 Days)</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.dailyChats || emptyChartData}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} dx={-10} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-1 bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex flex-col">
            <h3 className="font-bold font-display text-lg mb-6">Top Customer Queries</h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {data?.topQueries && data.topQueries.length > 0 ? (
                data.topQueries.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    <p className="text-sm font-medium leading-snug">{item.query}</p>
                    <div className="px-2 py-1 rounded-md bg-background border border-border/50 text-xs font-bold text-muted-foreground whitespace-nowrap">
                      {item.count}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No queries recorded yet. Start chatting to see insights.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({ title, value, trend, icon }: { title: string, value: string | number, trend: string, icon: React.ReactNode }) {
  return (
    <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="p-3 bg-secondary/50 rounded-xl">
          {icon}
        </div>
        <div className="px-2.5 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold rounded-full">
          {trend}
        </div>
      </div>
      <div className="relative z-10">
        <h4 className="text-muted-foreground font-medium text-sm mb-1">{title}</h4>
        <div className="text-3xl font-display font-bold text-foreground">{value}</div>
      </div>
    </div>
  );
}
