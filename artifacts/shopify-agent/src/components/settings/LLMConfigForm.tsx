import { useState, useEffect } from "react";
import { useGetStore, useUpdateStore, getGetStoreQueryKey } from "@workspace/api-client-react";
import { Save, Key, Database, Globe, Shield, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type ProviderValue = "openai" | "anthropic" | "xai";

export function LLMConfigForm({ storeDomain }: { storeDomain: string }) {
  const { data: store } = useGetStore(storeDomain, { query: { queryKey: getGetStoreQueryKey(storeDomain), staleTime: 60_000 } });
  const { mutateAsync: updateStore, isPending: updating } = useUpdateStore();
  const { toast } = useToast();

  const [provider, setProvider] = useState<ProviderValue>("openai");
  const [model, setModel] = useState("gpt-4o");
  const [apiKey, setApiKey] = useState("");
  const [storefrontToken, setStorefrontToken] = useState("");
  const [ucpCompliant, setUcpCompliant] = useState(true);
  const [chatEnabled, setChatEnabled] = useState(true);

  useEffect(() => {
    if (store) {
      setProvider(store.provider as ProviderValue);
      setModel(store.model);
      if (store.storefrontToken) {
        setStorefrontToken(store.storefrontToken);
      }
      setUcpCompliant(store.ucpCompliant ?? true);
      setChatEnabled(store.chatEnabled ?? true);
    }
  }, [store]);

  const handleSaveStore = async () => {
    try {
      await updateStore({
        storeDomain,
        data: {
          provider,
          model,
          storefrontToken: storefrontToken || undefined,
          ucpCompliant,
          chatEnabled,
          ...(apiKey ? { apiKey } : {})
        }
      });
      toast({ title: "Settings saved successfully", variant: "default" });
      setApiKey("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Failed to save", description: message, variant: "destructive" });
    }
  };

  return (
    <>
      <section className="bg-card border border-border/50 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
            <Globe className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold font-display">Shopify Connection</h2>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-3">
            <Label>Storefront Access Token</Label>
            <div className="relative">
              <Input 
                value={storefrontToken} 
                onChange={(e) => setStorefrontToken(e.target.value)}
                placeholder="Enter your Storefront Access Token"
                className="rounded-xl h-12 bg-secondary/20 pl-10"
              />
              <Key className="w-4 h-4 text-muted-foreground absolute left-4 top-4" />
            </div>
            <p className="text-xs text-muted-foreground">
              Required for product search, cart management, and checkout. Find this in your Shopify Admin under Apps &gt; Develop apps &gt; Storefront API.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-card border border-border/50 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-500/10 text-blue-600 rounded-xl">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold font-display">Chat Widget</h2>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${chatEnabled ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'}`}>
            {chatEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Control whether the AI chat widget is active on your store. When disabled, both the chat widget and the Shop For Me page will be inactive for customers.
          </p>
          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/20 border border-border/50">
            <div>
              <p className="font-medium text-sm">Enable Chat Widget</p>
              <p className="text-xs text-muted-foreground mt-0.5">Allow customers to interact with your AI shopping assistant</p>
            </div>
            <Switch
              checked={chatEnabled}
              onCheckedChange={setChatEnabled}
            />
          </div>
          {!chatEnabled && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                The chat widget and Shop For Me page are currently inactive. Customers will not be able to use the AI shopping assistant until you re-enable this setting.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="bg-card border border-border/50 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-violet-500/10 text-violet-600 rounded-xl">
            <Shield className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold font-display">UCP Compliance</h2>
          <span className="px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-semibold">
            UCP Compliant
          </span>
        </div>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            The Universal Commerce Protocol (UCP) is an open standard for agentic commerce that standardizes discovery, checkout, orders, and payment flows across AI agents. When enabled, the agent will attempt UCP capability discovery and use UCP primitives for commerce actions.
          </p>
          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/20 border border-border/50">
            <div>
              <p className="font-medium text-sm">Enable UCP Discovery</p>
              <p className="text-xs text-muted-foreground mt-0.5">Discover and use UCP checkout, order, and payment primitives via MCP</p>
            </div>
            <Switch
              checked={ucpCompliant}
              onCheckedChange={setUcpCompliant}
            />
          </div>
        </div>
      </section>

      <section className="bg-card border border-border/50 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 text-primary rounded-xl">
            <Database className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold font-display">Model Configuration</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-3">
            <Label>AI Provider</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as ProviderValue)}>
              <SelectTrigger className="rounded-xl h-12 bg-secondary/20">
                <SelectValue placeholder="Select Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="xai">Grok (xAI)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <Label>Model Version</Label>
            <Input 
              value={model} 
              onChange={(e) => setModel(e.target.value)} 
              className="rounded-xl h-12 bg-secondary/20"
              placeholder="e.g. gpt-4o, claude-3-sonnet"
            />
          </div>
          <div className="col-span-1 md:col-span-2 space-y-3">
            <Label>API Key</Label>
            <div className="relative">
              <Input 
                type="password" 
                value={apiKey} 
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={store?.hasApiKey ? "Key is set. Enter new to replace." : "Enter API Key"}
                className="rounded-xl h-12 bg-secondary/20 pl-10"
              />
              <Key className="w-4 h-4 text-muted-foreground absolute left-4 top-4" />
            </div>
            <p className="text-xs text-muted-foreground">Your key is stored securely and only used to power your store's agent.</p>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button onClick={handleSaveStore} disabled={updating} className="rounded-xl px-8 shadow-lg shadow-primary/20">
            {updating ? "Saving..." : "Save Configuration"}
            <Save className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>
    </>
  );
}
