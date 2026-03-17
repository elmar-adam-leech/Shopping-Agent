import { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { EmbedChatPanel } from "./EmbedChatPanel";

interface ProductAssistantProps {
  storeDomain: string;
  productHandle: string;
}

export function ProductAssistant({ storeDomain, productHandle }: ProductAssistantProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-background">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="w-4 h-4 text-primary" />
          AI Product Assistant
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-border" style={{ height: "400px" }}>
          <EmbedChatPanel
            storeDomain={storeDomain}
            productHandle={productHandle}
            initialMessage={`Tell me about this product: ${productHandle}`}
          />
        </div>
      )}
    </div>
  );
}
