import { Sparkles } from "lucide-react";

interface ChatEmptyStateProps {
  storeDomain: string;
  onPresetClick: (preset: string) => void;
  welcomeMessage?: string | null;
}

export function ChatEmptyState({ storeDomain, onPresetClick, welcomeMessage }: ChatEmptyStateProps) {
  const presets = [
    "Show me your best sellers",
    "What are your return policies?",
    "Find matching accessories",
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-700">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white mb-6 shadow-xl shadow-primary/20">
        <Sparkles className="w-10 h-10" />
      </div>
      <h3 className="text-2xl font-display font-bold mb-2 text-foreground">How can I help you today?</h3>
      <p className="text-muted-foreground max-w-sm mb-8">
        {welcomeMessage || `I'm an AI assistant for ${storeDomain}. Ask me anything about products, sizing, or policies!`}
      </p>
      <div className="flex flex-wrap justify-center gap-2 max-w-lg" role="group" aria-label="Suggested questions">
        {presets.map(preset => (
          <button 
            key={preset}
            onClick={() => onPresetClick(preset)}
            className="px-4 py-3 min-h-11 rounded-full bg-secondary/50 border border-border/50 text-sm hover:bg-secondary hover:text-foreground text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}
