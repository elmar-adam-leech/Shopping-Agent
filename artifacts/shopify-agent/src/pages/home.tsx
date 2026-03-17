import { Link } from "wouter";
import { Store as StoreIcon, Plus, ArrowRight, Settings, MessageSquare, Activity } from "lucide-react";
import { useListStores } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const { data: stores, isLoading } = useListStores();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hero section */}
      <div className="relative pt-24 pb-16 px-6 lg:px-8 overflow-hidden">
        <img
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
          alt="Hero Background"
          className="absolute inset-0 w-full h-full object-cover opacity-10 z-0"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background z-0" />
        
        <div className="max-w-5xl mx-auto relative z-10 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-6 text-primary mb-6 animate-in slide-in-from-bottom-4 duration-500 fade-in">
            <img 
              src={`${import.meta.env.BASE_URL}images/logo.png`} 
              alt="Logo" 
              className="w-12 h-12 drop-shadow-md rounded-xl"
            />
          </div>
          <h1 className="text-5xl md:text-6xl font-display font-extrabold tracking-tight text-foreground mb-6 animate-in slide-in-from-bottom-6 duration-700 fade-in">
            Your Stores, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Supercharged</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-in slide-in-from-bottom-8 duration-1000 fade-in">
            Manage your AI Shopping Agents across multiple storefronts. Inject domain expertise and let AI drive your conversions.
          </p>
          <div className="flex items-center justify-center gap-4 animate-in slide-in-from-bottom-10 duration-1000 fade-in">
            <Link href="/install">
              <Button size="lg" className="rounded-full px-8 py-6 text-base font-bold shadow-xl shadow-primary/25 hover:scale-105 transition-transform">
                <Plus className="w-5 h-5 mr-2" /> Connect New Store
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stores Grid */}
      <div className="max-w-5xl mx-auto px-6 lg:px-8 relative z-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold font-display flex items-center gap-3">
            <StoreIcon className="w-6 h-6 text-primary" />
            Connected Stores
          </h2>
          <Badge count={stores?.length || 0} />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-[220px] rounded-3xl bg-secondary/50 animate-pulse border border-border/50" />
            ))}
          </div>
        ) : stores && stores.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
              <StoreCard key={store.storeDomain} store={store} />
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-3xl p-12 text-center flex flex-col items-center justify-center">
            <div className="w-20 h-20 bg-secondary/50 rounded-full flex items-center justify-center mb-6">
              <StoreIcon className="w-10 h-10 text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-xl font-bold mb-2">No stores connected yet</h3>
            <p className="text-muted-foreground mb-8 max-w-md">
              Connect your first Shopify store to start configuring your AI shopping agent and engaging with customers.
            </p>
            <Link href="/install">
              <Button variant="outline" className="rounded-full px-6">
                Connect a Store
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

interface StoreInfo {
  storeDomain: string;
  storefrontToken?: string | null;
  provider: string;
  model: string;
  hasApiKey: boolean;
  createdAt: string;
}

function StoreCard({ store }: { store: StoreInfo }) {
  return (
    <div className="group relative bg-card hover:bg-card/80 border border-border/50 hover:border-primary/30 rounded-3xl p-6 transition-all duration-300 shadow-lg shadow-slate-200/20 dark:shadow-none hover:shadow-xl hover:shadow-primary/10 overflow-hidden flex flex-col">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full -z-10 transition-transform duration-500 group-hover:scale-110" />
      
      <div className="flex items-start justify-between mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white shadow-md shadow-primary/20">
          <StoreIcon className="w-6 h-6" />
        </div>
        <div className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold tracking-wide">
          Active
        </div>
      </div>

      <div className="flex-1">
        <h3 className="text-xl font-bold font-display text-foreground mb-1 truncate" title={store.storeDomain}>
          {store.storeDomain}
        </h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <span className="capitalize">{store.provider}</span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span>{store.model}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-auto">
        <Link href={`/${store.storeDomain}/chat`} className="col-span-1">
          <Button variant="secondary" className="w-full bg-secondary/50 hover:bg-secondary rounded-xl tooltip-trigger" title="Test Chat">
            <MessageSquare className="w-4 h-4" />
          </Button>
        </Link>
        <Link href={`/${store.storeDomain}/settings`} className="col-span-1">
          <Button variant="secondary" className="w-full bg-secondary/50 hover:bg-secondary rounded-xl tooltip-trigger" title="Settings">
            <Settings className="w-4 h-4" />
          </Button>
        </Link>
        <Link href={`/${store.storeDomain}/analytics`} className="col-span-1">
          <Button variant="secondary" className="w-full bg-secondary/50 hover:bg-secondary rounded-xl tooltip-trigger" title="Analytics">
            <Activity className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Badge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
      {count}
    </span>
  );
}
