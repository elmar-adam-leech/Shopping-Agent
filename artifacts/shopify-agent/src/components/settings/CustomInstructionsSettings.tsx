import { useState, useEffect } from "react";
import { useGetStore, useUpdateStore, getGetStoreQueryKey } from "@workspace/api-client-react";
import { Save, FileText, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const MAX_INSTRUCTIONS_LENGTH = 2000;

export function CustomInstructionsSettings({ storeDomain }: { storeDomain: string }) {
  const { data: store } = useGetStore(storeDomain, {
    query: { queryKey: getGetStoreQueryKey(storeDomain), staleTime: 60_000 },
  });
  const { mutateAsync: updateStore, isPending: updating } = useUpdateStore();
  const { toast } = useToast();

  const [customInstructions, setCustomInstructions] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (store) {
      setCustomInstructions(store.customInstructions ?? "");
    }
  }, [store]);

  const handleSave = async () => {
    try {
      await updateStore({
        storeDomain,
        data: {
          customInstructions: customInstructions || null,
        },
      });
      toast({ title: "Custom instructions saved" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Failed to save", description: message, variant: "destructive" });
    }
  };

  return (
    <section className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
      <div className="p-6 md:p-8 border-b border-border/50 bg-secondary/10">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-orange-500/10 text-orange-600 rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold font-display">Custom Instructions</h2>
        </div>
        <p className="text-muted-foreground">Write free-form instructions that are always included in the AI's system prompt. These shape every response the agent gives.</p>
      </div>

      <div className="p-6 md:p-8 space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Instructions</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs gap-1.5"
            >
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPreview ? "Hide Preview" : "Show Preview"}
            </Button>
          </div>
          <Textarea
            value={customInstructions}
            onChange={(e) => {
              if (e.target.value.length <= MAX_INSTRUCTIONS_LENGTH) {
                setCustomInstructions(e.target.value);
              }
            }}
            placeholder={`Write any special instructions for your AI agent. For example:\n\n- Always recommend our premium line first\n- Never mention competitor brands\n- If asked about warranty, always mention our 2-year extended warranty option\n- Use metric units for all measurements`}
            className="min-h-[160px] rounded-xl resize-y bg-secondary/20 font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">{customInstructions.length}/{MAX_INSTRUCTIONS_LENGTH} characters</p>
        </div>

        {showPreview && customInstructions && (
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">System Prompt Preview</p>
            <div className="text-sm text-foreground/80 font-mono whitespace-pre-wrap">
              <span className="text-primary font-semibold">## Custom Instructions from Store Owner</span>
              {"\n"}The store owner has provided the following special instructions that you must follow:
              {"\n"}{customInstructions}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={updating} className="rounded-xl px-8 shadow-lg shadow-primary/20">
            {updating ? "Saving..." : "Save Instructions"}
            <Save className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
}
