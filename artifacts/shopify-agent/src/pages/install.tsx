import { useState } from "react";
import { Store, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function InstallPage() {
  const [shop, setShop] = useState("");

  const handleInstall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop.trim()) return;
    
    const shopDomain = `${shop.trim().replace(/\.myshopify\.com$/i, "")}.myshopify.com`;
    window.location.href = `/api/auth/install?shop=${encodeURIComponent(shopDomain)}`;
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden p-4">
      {/* Decorative background */}
      <img
        src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover opacity-30 z-0"
      />
      
      <div className="glass-card max-w-md w-full p-8 rounded-3xl z-10 relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[40px] -mr-10 -mt-10" />
        
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-primary to-primary/70 flex items-center justify-center text-white shadow-lg shadow-primary/30">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl leading-none">Storefront Shopping Agent</h1>
            <p className="text-muted-foreground text-sm font-medium">for Shopify</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-2">Connect your store</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Install the Shopping Agent to give your customers a personalized, deeply knowledgeable shopping assistant powered by your own data.
            </p>
          </div>

          <form onSubmit={handleInstall} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shop">Shopify Store Domain</Label>
              <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden focus-within:ring-2 focus-within:ring-primary/20">
                <Input
                  id="shop"
                  placeholder="your-store"
                  value={shop}
                  onChange={(e) => setShop(e.target.value)}
                  className="border-0 pl-4 py-6 text-base bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <span className="pr-4 text-muted-foreground text-sm font-medium whitespace-nowrap select-none">.myshopify.com</span>
              </div>
            </div>

            <Button 
              type="submit" 
              size="lg" 
              className="w-full py-6 rounded-xl text-base font-bold shadow-xl shadow-primary/20 hover:shadow-primary/30 group"
            >
              Install
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </form>

          <div className="pt-6 border-t border-border/50 flex items-center gap-3 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Secure OAuth connection; no password needed.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
