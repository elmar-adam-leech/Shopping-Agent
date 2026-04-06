import { useState, useEffect } from "react";
import { useGetStore, useUpdateStore, getGetStoreQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Palette, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type ToneValue = "friendly" | "professional" | "playful" | "luxury";
type RecommendationStrategy = "bestsellers_first" | "new_arrivals_first" | "price_low_to_high" | "personalized";

const TONE_OPTIONS: { value: ToneValue; label: string; desc: string }[] = [
  { value: "friendly", label: "Friendly", desc: "Warm, approachable, and conversational" },
  { value: "professional", label: "Professional", desc: "Polished, authoritative, and business-like" },
  { value: "playful", label: "Playful", desc: "Fun, energetic, and casual" },
  { value: "luxury", label: "Luxury", desc: "Elegant, refined, and exclusive" },
];

const STRATEGY_OPTIONS: { value: RecommendationStrategy; label: string; desc: string }[] = [
  { value: "personalized", label: "Personalized", desc: "Tailored to customer preferences" },
  { value: "bestsellers_first", label: "Best Sellers First", desc: "Prioritize popular products" },
  { value: "new_arrivals_first", label: "New Arrivals First", desc: "Highlight newest products" },
  { value: "price_low_to_high", label: "Price: Low to High", desc: "Start with affordable options" },
];

export function BrandVoiceSettings({ storeDomain }: { storeDomain: string }) {
  const queryClient = useQueryClient();
  const storeQueryKey = getGetStoreQueryKey(storeDomain);
  const { data: store } = useGetStore(storeDomain, {
    query: { queryKey: storeQueryKey, staleTime: 60_000 },
  });
  const { mutateAsync: updateStore, isPending: updating } = useUpdateStore();
  const { toast } = useToast();

  const [tone, setTone] = useState<ToneValue>("friendly");
  const [personality, setPersonality] = useState("");
  const [greeting, setGreeting] = useState("");
  const [signOff, setSignOff] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [recommendationStrategy, setRecommendationStrategy] = useState<RecommendationStrategy>("personalized");

  useEffect(() => {
    if (store) {
      const bv = store.brandVoice as { tone?: string; personality?: string; greeting?: string; signOff?: string } | null;
      if (bv) {
        setTone((bv.tone as ToneValue) ?? "friendly");
        setPersonality(bv.personality ?? "");
        setGreeting(bv.greeting ?? "");
        setSignOff(bv.signOff ?? "");
      }
      setWelcomeMessage(store.welcomeMessage ?? "");
      setRecommendationStrategy((store.recommendationStrategy as RecommendationStrategy) ?? "personalized");
    }
  }, [store]);

  const handleSave = async () => {
    const updateData = {
      brandVoice: { tone, personality, greeting, signOff },
      welcomeMessage: welcomeMessage || null,
      recommendationStrategy,
    };
    const previousStore = queryClient.getQueryData(storeQueryKey);
    queryClient.setQueryData(storeQueryKey, (old: Record<string, unknown> | undefined) => old ? { ...old, ...updateData } : old);
    try {
      await updateStore({ storeDomain, data: updateData });
      queryClient.invalidateQueries({ queryKey: storeQueryKey });
      toast({ title: "Brand voice settings saved" });
    } catch (err: unknown) {
      queryClient.setQueryData(storeQueryKey, previousStore);
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Failed to save", description: message, variant: "destructive" });
    }
  };

  return (
    <section className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
      <div className="p-6 md:p-8 border-b border-border/50 bg-secondary/10">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-purple-500/10 text-purple-600 rounded-xl">
            <Palette className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold font-display">Brand Identity</h2>
        </div>
        <p className="text-muted-foreground">Define your brand's voice and personality to shape how the AI assistant communicates with customers.</p>
      </div>

      <div className="p-6 md:p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <Label>Tone</Label>
            <Select value={tone} onValueChange={(v) => setTone(v as ToneValue)}>
              <SelectTrigger className="rounded-xl h-12 bg-secondary/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{opt.desc}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Recommendation Strategy</Label>
            <Select value={recommendationStrategy} onValueChange={(v) => setRecommendationStrategy(v as RecommendationStrategy)}>
              <SelectTrigger className="rounded-xl h-12 bg-secondary/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STRATEGY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{opt.desc}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Personality Description</Label>
          <Textarea
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            placeholder="e.g. You are a knowledgeable outdoor gear expert who loves helping people find the perfect equipment for their adventures."
            className="min-h-[80px] rounded-xl resize-y bg-secondary/20"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground">{personality.length}/500 characters</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <Label>Greeting Style</Label>
            <Input
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder="e.g. Hey there! Welcome to our store."
              className="rounded-xl h-12 bg-secondary/20"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">How the agent greets customers in conversation</p>
          </div>

          <div className="space-y-3">
            <Label>Sign-off Style</Label>
            <Input
              value={signOff}
              onChange={(e) => setSignOff(e.target.value)}
              placeholder="e.g. Happy shopping! Let me know if you need anything else."
              className="rounded-xl h-12 bg-secondary/20"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">How the agent wraps up conversations</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <Label>Welcome Message</Label>
          </div>
          <Textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="e.g. Hi! I'm your personal shopping assistant. I can help you find products, check sizing, or answer any questions about our store."
            className="min-h-[80px] rounded-xl resize-y bg-secondary/20"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground">
            This message greets customers when they first open the chat. Leave empty to use the default greeting. {welcomeMessage.length}/500 characters
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={updating} className="rounded-xl px-8 shadow-lg shadow-primary/20">
            {updating ? "Saving..." : "Save Brand Settings"}
            <Save className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
}
