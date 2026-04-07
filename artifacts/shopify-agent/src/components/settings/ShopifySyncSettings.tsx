import { useState } from "react";
import {
  useGetKnowledgeSyncStatus,
  useTriggerKnowledgeSync,
  useUpdateSyncSettings,
  getGetKnowledgeSyncStatusQueryKey,
  getListKnowledgeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Cloud, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface SyncResultData {
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
  errors: string[];
  syncedAt: string;
}

export function ShopifySyncSettings({ storeDomain }: { storeDomain: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResultData | null>(null);

  const { data: syncStatus, refetch: refetchStatus } = useGetKnowledgeSyncStatus(storeDomain, {
    query: {
      queryKey: getGetKnowledgeSyncStatusQueryKey(storeDomain),
      staleTime: 30_000,
    },
  });

  const { mutateAsync: triggerSync } = useTriggerKnowledgeSync();
  const { mutateAsync: updateSettings } = useUpdateSyncSettings();

  const handleSync = async () => {
    setSyncing(true);
    setLastResult(null);
    try {
      const result = await triggerSync({ storeDomain });
      setLastResult(result as SyncResultData);
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: getListKnowledgeQueryKey(storeDomain) });
      const r = result as SyncResultData;
      if (r.errors.length === 0) {
        toast({ title: `Sync complete: ${r.created} created, ${r.updated} updated, ${r.deleted} removed` });
      } else {
        toast({
          title: "Sync completed with errors",
          description: `${r.errors.length} error(s) occurred`,
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleFrequencyChange = async (value: string) => {
    try {
      await updateSettings({
        storeDomain,
        data: { syncFrequency: value as "manual" | "daily" | "weekly" },
      });
      refetchStatus();
      toast({ title: `Sync frequency updated to ${value}` });
    } catch {
      toast({ title: "Failed to update sync settings", variant: "destructive" });
    }
  };

  const status = syncStatus as { syncFrequency: string; lastSyncedAt: string | null; syncedEntryCount: number } | undefined;

  return (
    <div className="p-5 border-2 border-dashed border-border rounded-2xl bg-background/50 space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <Cloud className="w-4 h-4 text-primary" /> Shopify Content Sync
      </h3>
      <p className="text-sm text-muted-foreground">
        Automatically import pages, blog articles, and store policies from your Shopify store into your knowledge base.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Sync Frequency</Label>
          <Select
            value={status?.syncFrequency ?? "manual"}
            onValueChange={handleFrequencyChange}
          >
            <SelectTrigger className="rounded-xl bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual Only</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Manual Sync</Label>
          <Button
            onClick={handleSync}
            disabled={syncing}
            variant="outline"
            className="w-full rounded-xl gap-2"
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Sync Now
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        {status?.lastSyncedAt && (
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Last synced: {new Date(status.lastSyncedAt).toLocaleString()}
          </span>
        )}
        {status !== undefined && (
          <span className="flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5" />
            {status.syncedEntryCount} synced entries
          </span>
        )}
      </div>

      {lastResult && (
        <div className={`p-3 rounded-xl text-sm ${lastResult.errors.length > 0 ? "bg-destructive/10 border border-destructive/20" : "bg-green-500/10 border border-green-500/20"}`}>
          <div className="flex items-center gap-2 mb-1">
            {lastResult.errors.length > 0 ? (
              <AlertCircle className="w-4 h-4 text-destructive" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            )}
            <span className="font-medium">
              {lastResult.created} created, {lastResult.updated} updated, {lastResult.deleted} removed, {lastResult.unchanged} unchanged
            </span>
          </div>
          {lastResult.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-destructive text-xs">
              {lastResult.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
