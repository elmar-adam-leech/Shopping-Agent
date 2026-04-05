import { useState, useEffect, useCallback, useRef } from "react";
import { UserCircle, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface CustomerAccountConnectProps {
  storeDomain: string;
  sessionId: string;
}

interface DiscoveryResponse {
  available: boolean;
  connected: boolean;
  mcpApiUrl?: string;
}

interface ConnectResponse {
  authorizationUrl: string;
}

export function CustomerAccountConnect({ storeDomain, sessionId }: CustomerAccountConnectProps) {
  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();
  const discoveryFetchedRef = useRef(false);

  const fetchDiscovery = useCallback(async () => {
    if (!storeDomain || !sessionId) return;
    try {
      setLoading(true);
      const res = await fetch(
        `/api/stores/${storeDomain}/mcp/discover?sessionId=${encodeURIComponent(sessionId)}`
      );
      if (res.ok) {
        const data = (await res.json()) as DiscoveryResponse;
        setDiscovery(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [storeDomain, sessionId]);

  useEffect(() => {
    if (!discoveryFetchedRef.current && storeDomain && sessionId) {
      discoveryFetchedRef.current = true;
      fetchDiscovery();
    }
  }, [fetchDiscovery, storeDomain, sessionId]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "mcp-connected" && event.data.storeDomain === storeDomain) {
        toast({ title: "Customer Account Connected", description: "You can now access order history and account features." });
        fetchDiscovery();
        setConnecting(false);
      } else if (event.data?.type === "mcp-error") {
        toast({
          title: "Connection Failed",
          description: event.data.error || "Failed to connect customer account.",
          variant: "destructive",
        });
        setConnecting(false);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [storeDomain, fetchDiscovery, toast]);

  const handleConnect = useCallback(async () => {
    if (!storeDomain || !sessionId) return;
    setConnecting(true);
    try {
      const res = await fetch(`/api/stores/${storeDomain}/mcp/connect?sessionId=${encodeURIComponent(sessionId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Connection failed" }));
        throw new Error((err as { error?: string }).error || "Connection failed");
      }

      const data = (await res.json()) as ConnectResponse;
      window.open(data.authorizationUrl, "_blank", "width=600,height=700");
    } catch (err) {
      toast({
        title: "Connection Failed",
        description: err instanceof Error ? err.message : "Failed to start connection.",
        variant: "destructive",
      });
      setConnecting(false);
    }
  }, [storeDomain, sessionId, toast]);

  const handleDisconnect = useCallback(async () => {
    if (!storeDomain || !sessionId) return;
    try {
      const res = await fetch(
        `/api/stores/${storeDomain}/mcp/connection?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: "DELETE",
          headers: { "x-session-id": sessionId },
        }
      );

      if (res.ok) {
        toast({ title: "Disconnected", description: "Customer account has been disconnected." });
        fetchDiscovery();
      }
    } catch {
      toast({
        title: "Disconnect Failed",
        description: "Failed to disconnect customer account.",
        variant: "destructive",
      });
    }
  }, [storeDomain, sessionId, fetchDiscovery, toast]);

  if (loading || !discovery || !discovery.available) {
    return null;
  }

  if (discovery.connected) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1.5 text-green-700 border-green-200 bg-green-50">
          <UserCircle className="w-3.5 h-3.5" />
          Account Connected
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={handleDisconnect}
          title="Disconnect customer account"
        >
          <LogOut className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 text-xs"
      onClick={handleConnect}
      disabled={connecting}
    >
      {connecting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <UserCircle className="w-3.5 h-3.5" />
      )}
      Connect Account
    </Button>
  );
}
