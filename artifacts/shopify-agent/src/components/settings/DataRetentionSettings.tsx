import { useState, useEffect } from "react";
import { Shield, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useGetStore, useUpdateStore } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

interface DataRetentionSettingsProps {
  storeDomain: string;
}

export function DataRetentionSettings({ storeDomain }: DataRetentionSettingsProps) {
  const { data: store } = useGetStore(storeDomain);
  const { mutateAsync: updateStore } = useUpdateStore();
  const { toast } = useToast();
  const [days, setDays] = useState("90");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (store) {
      const storeAny = store as unknown as { dataRetentionDays?: number };
      if (storeAny.dataRetentionDays) {
        setDays(String(storeAny.dataRetentionDays));
      }
    }
  }, [store]);

  const handleSave = async () => {
    const val = parseInt(days, 10);
    if (!Number.isFinite(val) || val < 1 || val > 365) {
      toast({ title: "Invalid value", description: "Data retention must be between 1 and 365 days.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await updateStore({ storeDomain, data: { dataRetentionDays: val } as unknown as Record<string, unknown> });
      toast({ title: "Saved", description: `Data retention set to ${val} days.` });
    } catch {
      toast({ title: "Error", description: "Failed to update data retention settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-xl">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-display font-semibold">Data Retention</h2>
          <p className="text-sm text-muted-foreground">Configure how long customer data is stored before automatic purging.</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="retention-days">Retention Period (days)</Label>
          <div className="flex items-center gap-3">
            <Input
              id="retention-days"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">days (1-365)</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Customer conversations, preferences, and analytics data older than this period will be automatically deleted. Default is 90 days.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Retention Settings"}
        </Button>
      </div>
    </section>
  );
}
