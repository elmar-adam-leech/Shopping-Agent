import { useState, useEffect } from "react";
import {
  useListExperiments,
  useCreateExperiment,
  useCompleteExperiment,
  useGetExperimentAnalytics,
  getListExperimentsQueryKey,
  getGetExperimentAnalyticsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  FlaskConical,
  Plus,
  Trophy,
  BarChart3,
  CheckCircle2,
  Archive,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type ToneValue = "friendly" | "professional" | "playful" | "luxury";
type RecommendationStrategy = "bestsellers_first" | "new_arrivals_first" | "price_low_to_high" | "personalized";

const TONE_OPTIONS: { value: ToneValue; label: string }[] = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "playful", label: "Playful" },
  { value: "luxury", label: "Luxury" },
];

const STRATEGY_OPTIONS: { value: RecommendationStrategy; label: string }[] = [
  { value: "personalized", label: "Personalized" },
  { value: "bestsellers_first", label: "Best Sellers First" },
  { value: "new_arrivals_first", label: "New Arrivals First" },
  { value: "price_low_to_high", label: "Price: Low to High" },
];

interface VariantConfig {
  brandVoice?: {
    tone: ToneValue;
    personality?: string;
    greeting?: string;
    signOff?: string;
  } | null;
  customInstructions?: string | null;
  recommendationStrategy?: string;
}

function VariantEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: VariantConfig;
  onChange: (v: VariantConfig) => void;
}) {
  const bv = value.brandVoice ?? { tone: "friendly" as ToneValue };

  return (
    <div className="space-y-4 p-4 rounded-xl bg-secondary/20 border border-border/50">
      <h4 className="font-bold text-sm">{label}</h4>

      <div className="space-y-2">
        <Label className="text-xs">Tone</Label>
        <Select
          value={bv.tone}
          onValueChange={(v) =>
            onChange({
              ...value,
              brandVoice: { ...bv, tone: v as ToneValue },
            })
          }
        >
          <SelectTrigger className="rounded-lg h-9 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TONE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Personality</Label>
        <Input
          value={bv.personality ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              brandVoice: { ...bv, personality: e.target.value },
            })
          }
          placeholder="e.g. Knowledgeable outdoor gear expert"
          className="rounded-lg h-9 bg-background"
          maxLength={300}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">Greeting</Label>
          <Input
            value={bv.greeting ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                brandVoice: { ...bv, greeting: e.target.value },
              })
            }
            placeholder="e.g. Hey there!"
            className="rounded-lg h-9 bg-background"
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Sign-off</Label>
          <Input
            value={bv.signOff ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                brandVoice: { ...bv, signOff: e.target.value },
              })
            }
            placeholder="e.g. Happy shopping!"
            className="rounded-lg h-9 bg-background"
            maxLength={200}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Recommendation Strategy</Label>
        <Select
          value={value.recommendationStrategy ?? "personalized"}
          onValueChange={(v) =>
            onChange({ ...value, recommendationStrategy: v })
          }
        >
          <SelectTrigger className="rounded-lg h-9 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STRATEGY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Custom Instructions</Label>
        <Textarea
          value={value.customInstructions ?? ""}
          onChange={(e) =>
            onChange({ ...value, customInstructions: e.target.value || null })
          }
          placeholder="Write specific instructions for this variant..."
          className="min-h-[80px] rounded-lg resize-y bg-background text-sm"
          maxLength={2000}
        />
      </div>
    </div>
  );
}

function ExperimentAnalyticsPanel({
  storeDomain,
  experimentId,
}: {
  storeDomain: string;
  experimentId: string;
}) {
  const { data, isLoading } = useGetExperimentAnalytics(storeDomain, experimentId, {
    query: {
      queryKey: getGetExperimentAnalyticsQueryKey(storeDomain, experimentId),
      staleTime: 30_000,
      refetchInterval: 60_000,
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  const metrics = [
    { label: "Sessions", a: data.variantA.sessionCount, b: data.variantB.sessionCount },
    { label: "Total Chats", a: data.variantA.totalChats, b: data.variantB.totalChats },
    { label: "Avg Msgs/Session", a: data.variantA.avgMessagesPerSession, b: data.variantB.avgMessagesPerSession },
    { label: "Carts Created", a: data.variantA.cartCreated, b: data.variantB.cartCreated },
    { label: "Checkouts", a: data.variantA.checkoutCompleted, b: data.variantB.checkoutCompleted },
    { label: "Conversion Rate", a: `${data.variantA.conversionRate}%`, b: `${data.variantB.conversionRate}%`, isRate: true },
  ];

  return (
    <div className="space-y-4">
      <h4 className="font-bold text-sm flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        Experiment Results
      </h4>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Metric</th>
              <th className="text-right py-2 px-3 font-semibold text-blue-500">Variant A</th>
              <th className="text-right py-2 px-3 font-semibold text-purple-500">Variant B</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, i) => {
              const aVal = typeof m.a === "string" ? parseFloat(m.a) : m.a;
              const bVal = typeof m.b === "string" ? parseFloat(m.b) : m.b;
              const aWins = aVal > bVal;
              const bWins = bVal > aVal;
              const tie = aVal === bVal;

              return (
                <tr key={i} className="border-b border-border/30">
                  <td className="py-2 px-3 font-medium">{m.label}</td>
                  <td className={`py-2 px-3 text-right font-bold ${!tie && aWins ? "text-green-600" : ""}`}>
                    {typeof m.a === "number" ? m.a.toLocaleString() : m.a}
                  </td>
                  <td className={`py-2 px-3 text-right font-bold ${!tie && bWins ? "text-green-600" : ""}`}>
                    {typeof m.b === "number" ? m.b.toLocaleString() : m.b}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ExperimentSettings({ storeDomain }: { storeDomain: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: experiments, isLoading } = useListExperiments(storeDomain, {
    query: {
      queryKey: getListExperimentsQueryKey(storeDomain),
      staleTime: 30_000,
    },
  });

  const { mutateAsync: createExperiment, isPending: creating } = useCreateExperiment();
  const { mutateAsync: completeExperiment, isPending: completing } = useCompleteExperiment();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [splitRatio, setSplitRatio] = useState(50);
  const [variantA, setVariantA] = useState<VariantConfig>({
    brandVoice: { tone: "friendly" },
    customInstructions: null,
  });
  const [variantB, setVariantB] = useState<VariantConfig>({
    brandVoice: { tone: "professional" },
    customInstructions: null,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeExperiment = experiments?.find((e) => e.status === "active");
  const pastExperiments = experiments?.filter((e) => e.status !== "active") ?? [];

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: "Please enter an experiment name", variant: "destructive" });
      return;
    }

    try {
      await createExperiment({
        storeDomain,
        data: { name: name.trim(), variantA, variantB, splitRatio },
      });
      toast({ title: "Experiment created" });
      setShowCreate(false);
      setName("");
      queryClient.invalidateQueries({ queryKey: getListExperimentsQueryKey(storeDomain) });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Failed to create experiment", description: message, variant: "destructive" });
    }
  };

  const handleComplete = async (experimentId: string, winner: "A" | "B") => {
    try {
      await completeExperiment({
        storeDomain,
        experimentId,
        data: { winner },
      });
      toast({ title: `Variant ${winner} declared as winner and applied as default` });
      queryClient.invalidateQueries({ queryKey: getListExperimentsQueryKey(storeDomain) });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Failed to complete experiment", description: message, variant: "destructive" });
    }
  };

  return (
    <section className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
      <div className="p-6 md:p-8 border-b border-border/50 bg-secondary/10">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-xl">
            <FlaskConical className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold font-display">A/B Prompt Testing</h2>
        </div>
        <p className="text-muted-foreground">
          Run experiments to compare different prompt strategies and find what converts best.
        </p>
      </div>

      <div className="p-6 md:p-8 space-y-6">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}

        {activeExperiment && (
          <div className="p-5 rounded-2xl border-2 border-primary/30 bg-primary/5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold">
                    Active
                  </span>
                  <h3 className="font-bold">{activeExperiment.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Split: {activeExperiment.splitRatio}% A / {100 - activeExperiment.splitRatio}% B
                  &middot; Started {new Date(activeExperiment.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <ExperimentAnalyticsPanel storeDomain={storeDomain} experimentId={activeExperiment.id} />

            <div className="flex items-center gap-3 pt-2 border-t border-border/50">
              <span className="text-sm text-muted-foreground font-medium">Declare winner:</span>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg gap-1.5"
                disabled={completing}
                onClick={() => handleComplete(activeExperiment.id, "A")}
              >
                <Trophy className="w-3.5 h-3.5 text-blue-500" />
                Variant A wins
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg gap-1.5"
                disabled={completing}
                onClick={() => handleComplete(activeExperiment.id, "B")}
              >
                <Trophy className="w-3.5 h-3.5 text-purple-500" />
                Variant B wins
              </Button>
            </div>
          </div>
        )}

        {!activeExperiment && !showCreate && (
          <Button
            variant="outline"
            onClick={() => setShowCreate(true)}
            className="rounded-xl gap-2 w-full py-6 border-dashed"
          >
            <Plus className="w-4 h-4" />
            Create New Experiment
          </Button>
        )}

        {showCreate && (
          <div className="space-y-5 p-5 rounded-2xl border border-border/50 bg-secondary/5">
            <h3 className="font-bold text-lg">New Experiment</h3>

            <div className="space-y-2">
              <Label>Experiment Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Friendly vs Professional tone"
                className="rounded-xl h-11 bg-secondary/20"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Traffic Split (% to Variant A)</Label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={10}
                  max={90}
                  value={splitRatio}
                  onChange={(e) => setSplitRatio(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-bold w-24 text-right">
                  {splitRatio}% / {100 - splitRatio}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <VariantEditor label="Variant A" value={variantA} onChange={setVariantA} />
              <VariantEditor label="Variant B" value={variantB} onChange={setVariantB} />
            </div>

            <div className="flex items-center gap-3 justify-end">
              <Button variant="ghost" onClick={() => setShowCreate(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="rounded-xl px-6 shadow-lg shadow-primary/20"
              >
                {creating ? "Creating..." : "Start Experiment"}
                <FlaskConical className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {pastExperiments.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">
              Past Experiments
            </h3>
            {pastExperiments.map((exp) => (
              <div
                key={exp.id}
                className="p-4 rounded-xl border border-border/50 bg-secondary/10"
              >
                <button
                  className="w-full flex items-center justify-between"
                  onClick={() => setExpandedId(expandedId === exp.id ? null : exp.id)}
                >
                  <div className="flex items-center gap-2">
                    {exp.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <Archive className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="font-medium text-sm">{exp.name}</span>
                    {exp.winner && (
                      <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-xs font-bold">
                        Winner: {exp.winner}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(exp.createdAt).toLocaleDateString()}
                    </span>
                    {expandedId === exp.id ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>
                {expandedId === exp.id && (
                  <div className="mt-4">
                    <ExperimentAnalyticsPanel storeDomain={storeDomain} experimentId={exp.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
