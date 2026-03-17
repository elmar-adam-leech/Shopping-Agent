import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatComposerProps {
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
}

export function ChatComposer({ input, isLoading, onInputChange, onSubmit }: ChatComposerProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-10">
      <div className="max-w-4xl mx-auto relative">
        <form 
          onSubmit={onSubmit}
          className="relative flex items-end bg-card border border-border shadow-xl shadow-black/5 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all"
        >
          <Textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about products, sizing, or policies..."
            className="min-h-[60px] max-h-[200px] w-full resize-none border-0 focus-visible:ring-0 bg-transparent py-4 pl-4 pr-14"
            rows={1}
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={!input.trim() || isLoading}
            className="absolute right-2 bottom-2 rounded-xl bg-primary text-white hover:bg-primary/90"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <div className="text-center mt-2">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            Powered by Shopify MCP Agent
          </span>
        </div>
      </div>
    </div>
  );
}
