import { useState, useEffect } from "react";
import { useGetStore, useUpdateStore, getGetStoreQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export function CheckoutRecoverySettings({ storeDomain }: { storeDomain: string }) {
  const queryClient = useQueryClient();
  const storeQueryKey = getGetStoreQueryKey(storeDomain);
  const { data: store } = useGetStore(storeDomain, {
    query: { queryKey: storeQueryKey, staleTime: 60_000 },
  });
  const { mutateAsync: updateStore, isPending: updating } = useUpdateStore();
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState(60);

  useEffect(() => {
    if (store) {
      setEnabled(store.checkoutRecoveryEnabled ?? false);
      setDelayMinutes(store.checkoutRecoveryDelayMinutes ?? 60);
    }
  }, [store]);

  const handleSave = async () => {
    const updateData = {
      checkoutRecoveryEnabled: enabled,
      checkoutRecoveryDelayMinutes: Math.max(1, Math.min(10080, delayMinutes)),
    };
    const previousStore = queryClient.getQueryData(storeQueryKey);
    queryClient.setQueryData(storeQueryKey, (old: Record<string, unknown> | undefined) => old ? { ...old, ...updateData } : old);
    try {
      await updateStore({ storeDomain, data: updateData });
      queryClient.invalidateQueries({ queryKey: storeQueryKey });
      toast({ title: "Checkout recovery settings saved", variant: "default" });
    } catch (err: unknown) {
      queryClient.setQueryData(storeQueryKey, previousStore);
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Failed to save", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white">
          <ShoppingCart className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Abandoned Checkout Recovery</h2>
          <p className="text-sm text-muted-foreground">Re-engage shoppers who left items in their cart.</p>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="flex items-center justify-between p-4 border border-border rounded-xl bg-card">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <div>
              <Label className="text-sm font-semibold">Enable Recovery Prompts</Label>
              <p className="text-xs text-muted-foreground">
                Proactively offer to resume abandoned checkouts when shoppers return
              </p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && (
          <div className="p-4 border border-border rounded-xl bg-card space-y-3">
            <div>
              <Label htmlFor="delay-minutes" className="text-sm font-semibold">
                Recovery Delay (minutes)
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Only prompt if the cart has been abandoned for at least this long
              </p>
              <Input
                id="delay-minutes"
                type="number"
                min={1}
                max={10080}
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 60)}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {delayMinutes >= 60
                  ? `${Math.floor(delayMinutes / 60)} hour${Math.floor(delayMinutes / 60) === 1 ? "" : "s"}${delayMinutes % 60 > 0 ? ` ${delayMinutes % 60} min` : ""}`
                  : `${delayMinutes} minute${delayMinutes === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
        )}

        <Button onClick={handleSave} disabled={updating} className="w-fit">
          {updating ? "Saving..." : "Save Recovery Settings"}
        </Button>
      </div>
    </div>
  );
}
