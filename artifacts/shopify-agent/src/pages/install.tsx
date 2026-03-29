import { useState } from "react";
import { Store, ArrowRight, ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StoreDomainInput } from "@/components/ui/store-domain-input";

const USER_FRIENDLY_ERRORS: Record<string, string> = {
  "Missing shop parameter": "Please provide a valid store domain.",
  "Invalid shop domain. Must be a valid .myshopify.com domain.": "That doesn't look like a valid Shopify store domain. Please check and try again.",
  "Server is busy, please try again later": "The server is currently busy. Please wait a moment and try again.",
};

function toFriendlyError(raw: string): string {
  if (USER_FRIENDLY_ERRORS[raw]) return USER_FRIENDLY_ERRORS[raw];
  if (/not configured|SHOPIFY_API_KEY|SHOPIFY_API_SECRET|APP_URL/i.test(raw)) {
    return "The app is not fully configured yet. Please contact the site administrator.";
  }
  return "Something went wrong. Please try again later.";
}

export default function InstallPage() {
  const [shop, setShop] = useState("");
  const [validationError, setValidationError] = useState("");
  const [installError, setInstallError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!shop.trim()) {
      setValidationError("Please enter your store domain");
      return;
    }
    setValidationError("");
    setInstallError("");
    setLoading(true);

    const shopDomain = `${shop.trim().replace(/\.myshopify\.com$/i, "")}.myshopify.com`;

    try {
      const res = await fetch(`/api/auth/install?shop=${encodeURIComponent(shopDomain)}`, {
        redirect: "manual",
      });

      if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
        const location = res.headers.get("location");
        if (location) {
          window.location.href = location;
          return;
        }
        window.location.href = `/api/auth/install?shop=${encodeURIComponent(shopDomain)}`;
        return;
      }

      if (!res.ok) {
        try {
          const data = await res.json();
          setInstallError(toFriendlyError(data.error || "Unknown error"));
        } catch {
          setInstallError("Something went wrong. Please try again later.");
        }
      } else {
        setInstallError("Unexpected response from the server. Please try again.");
      }
    } catch {
      setInstallError("Could not connect to the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden p-4">
      {/* Decorative background */}
      <img
        src={`${import.meta.env.BASE_URL}images/hero-bg.webp`}
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
              <StoreDomainInput
                id="shop"
                value={shop}
                onChange={(e) => { setShop(e.target.value); setValidationError(""); setInstallError(""); }}
                className="border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm focus-within:ring-primary/20"
                inputClassName="pl-4 py-6 text-base"
              />
              {validationError && (
                <p className="text-sm text-red-500" role="alert">{validationError}</p>
              )}
            </div>

            {installError && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50 p-3">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">{installError}</p>
              </div>
            )}

            <Button 
              type="submit" 
              size="lg" 
              disabled={loading}
              className="w-full py-6 rounded-xl text-base font-bold shadow-xl shadow-primary/20 hover:shadow-primary/30 group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  Install
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
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
