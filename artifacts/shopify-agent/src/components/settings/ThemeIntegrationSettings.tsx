import { useState, useEffect } from "react";
import { useGetStore, useUpdateStore } from "@workspace/api-client-react";
import { Code, MessageSquare, Search, Package, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export function ThemeIntegrationSettings({ storeDomain }: { storeDomain: string }) {
  const { data: store } = useGetStore(storeDomain);
  const { mutateAsync: updateStore, isPending: updating } = useUpdateStore();
  const { toast } = useToast();

  const [chatEnabled, setChatEnabled] = useState(true);
  const [embedEnabled, setEmbedEnabled] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  useEffect(() => {
    if (store) {
      setChatEnabled(store.chatEnabled ?? true);
      setEmbedEnabled(store.embedEnabled ?? false);
    }
  }, [store]);

  const handleSave = async () => {
    try {
      await updateStore({
        storeDomain,
        data: { chatEnabled, embedEnabled },
      });
      toast({ title: "Theme integration settings saved", variant: "default" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Failed to save", description: message, variant: "destructive" });
    }
  };

  const baseUrl = window.location.origin;

  const snippets = {
    chat: `<script src="${baseUrl}/embed.js" data-store-domain="${storeDomain}" data-mode="chat"></script>`,
    search: `<script src="${baseUrl}/embed.js" data-store-domain="${storeDomain}" data-mode="search" data-position="top-right"></script>`,
    product: `<script src="${baseUrl}/embed.js" data-store-domain="${storeDomain}" data-mode="product" data-product-handle="{{ product.handle }}"></script>`,
    iframe: `<iframe src="${baseUrl}/embed/${storeDomain}/chat?mode=embed" style="width:100%;height:600px;border:none;border-radius:12px;" title="AI Shopping Assistant"></iframe>`,
  };

  const copySnippet = (key: string) => {
    navigator.clipboard.writeText(snippets[key as keyof typeof snippets]);
    setCopiedSnippet(key);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white">
          <Code className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Theme Integration</h2>
          <p className="text-sm text-muted-foreground">Embed the AI assistant directly into your Shopify theme.</p>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="flex items-center justify-between p-4 border border-border rounded-xl bg-card">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-primary" />
            <div>
              <Label className="text-sm font-semibold">Chat Enabled</Label>
              <p className="text-xs text-muted-foreground">Allow customers to chat with your AI assistant</p>
            </div>
          </div>
          <Switch checked={chatEnabled} onCheckedChange={setChatEnabled} />
        </div>

        <div className="flex items-center justify-between p-4 border border-border rounded-xl bg-card">
          <div className="flex items-center gap-3">
            <Code className="w-5 h-5 text-primary" />
            <div>
              <Label className="text-sm font-semibold">Theme Embed Mode</Label>
              <p className="text-xs text-muted-foreground">Enable embedding via iframe or script tag</p>
            </div>
          </div>
          <Switch checked={embedEnabled} onCheckedChange={setEmbedEnabled} />
        </div>

        <Button onClick={handleSave} disabled={updating} className="w-fit">
          {updating ? "Saving..." : "Save Integration Settings"}
        </Button>
      </div>

      {embedEnabled && (
        <div className="space-y-4 pt-4 border-t border-border">
          <h3 className="text-lg font-semibold">Embed Snippets</h3>
          <p className="text-sm text-muted-foreground">Add any of these snippets to your Shopify theme to embed the AI assistant.</p>

          <SnippetBlock
            icon={<MessageSquare className="w-4 h-4" />}
            title="Chat Widget"
            description="Full chat panel — add to theme.liquid"
            snippet={snippets.chat}
            copied={copiedSnippet === "chat"}
            onCopy={() => copySnippet("chat")}
          />

          <SnippetBlock
            icon={<Search className="w-4 h-4" />}
            title="AI Search Bar"
            description="Replace native search with AI-powered search"
            snippet={snippets.search}
            copied={copiedSnippet === "search"}
            onCopy={() => copySnippet("search")}
          />

          <SnippetBlock
            icon={<Package className="w-4 h-4" />}
            title="Product Assistant"
            description="Inline AI assistant on product pages"
            snippet={snippets.product}
            copied={copiedSnippet === "product"}
            onCopy={() => copySnippet("product")}
          />

          <SnippetBlock
            icon={<Code className="w-4 h-4" />}
            title="Iframe Embed"
            description="For custom sections or headless stores"
            snippet={snippets.iframe}
            copied={copiedSnippet === "iframe"}
            onCopy={() => copySnippet("iframe")}
          />
        </div>
      )}
    </div>
  );
}

function SnippetBlock({ icon, title, description, snippet, copied, onCopy }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  snippet: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onCopy} className="gap-1.5">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="p-3 text-xs overflow-x-auto bg-secondary/20 text-foreground/80">
        <code>{snippet}</code>
      </pre>
    </div>
  );
}
