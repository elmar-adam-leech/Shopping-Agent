import { useState, useEffect, useCallback } from "react";
import { Radio, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface WebhookSettingsProps {
  storeDomain: string;
}

interface WebhookRegistration {
  id: string;
  topic: string;
  active: boolean;
  shopifyWebhookId: string | null;
  registeredAt: string;
  lastDeliveryAt: string | null;
  failureCount: number;
}

interface DeliveryLog {
  id: string;
  topic: string;
  status: string;
  processingTimeMs: number | null;
  error: string | null;
  receivedAt: string;
}

const BASE = import.meta.env.BASE_URL || "/";

function apiPath(path: string): string {
  const base = BASE.endsWith("/") ? BASE.slice(0, -1) : BASE;
  return `${base}/api${path}`;
}

export function WebhookSettings({ storeDomain }: WebhookSettingsProps) {
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<WebhookRegistration[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [reRegistering, setReRegistering] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [regRes, logRes] = await Promise.all([
        fetch(apiPath(`/stores/${encodeURIComponent(storeDomain)}/webhooks`), { credentials: "include" }),
        fetch(apiPath(`/stores/${encodeURIComponent(storeDomain)}/webhooks/delivery-log?limit=50`), { credentials: "include" }),
      ]);

      if (regRes.ok) {
        const data = await regRes.json();
        setRegistrations(data.webhooks || []);
      }

      if (logRes.ok) {
        const data = await logRes.json();
        setDeliveryLogs(data.deliveryLogs || []);
      }
    } catch {
      console.error("[WebhookSettings] Failed to fetch webhook data");
    } finally {
      setLoading(false);
    }
  }, [storeDomain]);

  useEffect(() => {
    if (storeDomain) fetchData();
  }, [storeDomain, fetchData]);

  const handleReRegister = async () => {
    setReRegistering(true);
    try {
      const res = await fetch(
        apiPath(`/stores/${encodeURIComponent(storeDomain)}/webhooks/re-register`),
        { method: "POST", credentials: "include" },
      );
      if (res.ok) {
        const data = await res.json();
        toast({
          title: "Webhooks Re-registered",
          description: `${data.registered?.length || 0} registered, ${data.failed?.length || 0} failed.`,
        });
        await fetchData();
      } else {
        toast({ title: "Error", description: "Failed to re-register webhooks.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to re-register webhooks.", variant: "destructive" });
    } finally {
      setReRegistering(false);
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "processed":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case "error":
      case "hmac_failed":
        return <XCircle className="w-3.5 h-3.5 text-red-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-amber-500" />;
    }
  };

  const activeCount = registrations.filter(r => r.active).length;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-500/10 rounded-xl">
          <Radio className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <h2 className="text-xl font-display font-semibold">Webhooks</h2>
          <p className="text-sm text-muted-foreground">Real-time sync for product, inventory, and order updates from Shopify.</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={activeCount > 0 ? "default" : "secondary"}>
              {activeCount > 0 ? `${activeCount} Active` : "None Registered"}
            </Badge>
            {registrations.some(r => r.failureCount > 0) && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                Failures Detected
              </Badge>
            )}
          </div>
          <Button
            onClick={handleReRegister}
            disabled={reRegistering || loading}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${reRegistering ? "animate-spin" : ""}`} />
            {reRegistering ? "Registering..." : "Re-register All"}
          </Button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-4">Loading webhook data...</div>
        ) : (
          <>
            <div>
              <h3 className="text-sm font-semibold mb-3">Registered Topics</h3>
              {registrations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No webhooks registered yet. Click "Re-register All" to set them up.
                </p>
              ) : (
                <div className="grid gap-2">
                  {registrations.map((reg) => (
                    <div
                      key={reg.id}
                      className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {reg.active ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        <code className="font-mono text-xs">{reg.topic}</code>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {reg.failureCount > 0 && (
                          <span className="text-red-400">{reg.failureCount} failures</span>
                        )}
                        {reg.lastDeliveryAt && (
                          <span>Last: {formatTime(reg.lastDeliveryAt)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Recent Delivery Log</h3>
              {deliveryLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No webhook deliveries recorded yet.</p>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-1">
                  {deliveryLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-lg text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {statusIcon(log.status)}
                        <code className="font-mono">{log.topic}</code>
                        <Badge variant={log.status === "processed" ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">
                          {log.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        {log.processingTimeMs !== null && (
                          <span>{log.processingTimeMs}ms</span>
                        )}
                        <span>{formatTime(log.receivedAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <p className="text-xs text-muted-foreground">
          Webhooks keep your AI agent's product and inventory data in sync with Shopify in real-time. If deliveries are failing, try re-registering.
        </p>
      </div>
    </section>
  );
}
