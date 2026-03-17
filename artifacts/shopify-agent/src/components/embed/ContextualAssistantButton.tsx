import { useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmbedChatPanel } from "./EmbedChatPanel";

interface ContextualAssistantButtonProps {
  storeDomain: string;
  productHandle?: string;
  collectionHandle?: string;
  cartToken?: string;
  label?: string;
  expanded?: boolean;
}

export function ContextualAssistantButton({
  storeDomain,
  productHandle,
  collectionHandle,
  cartToken,
  label = "Ask AI",
  expanded = false,
}: ContextualAssistantButtonProps) {
  const [isOpen, setIsOpen] = useState(expanded);

  const contextMessage = productHandle
    ? `Tell me about this product: ${productHandle}`
    : collectionHandle
      ? `Show me products from the "${collectionHandle}" collection`
      : cartToken
        ? `Help me review my cart`
        : undefined;

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="gap-2 rounded-full shadow-lg"
        size="sm"
      >
        <MessageSquare className="w-4 h-4" />
        {label}
      </Button>
    );
  }

  return (
    <div className="flex flex-col border border-border rounded-xl overflow-hidden shadow-xl bg-background" style={{ height: "500px", width: "100%", maxWidth: "420px" }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card">
        <span className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          AI Assistant
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        <EmbedChatPanel
          storeDomain={storeDomain}
          productHandle={productHandle}
          collectionHandle={collectionHandle}
          cartToken={cartToken}
          initialMessage={contextMessage}
        />
      </div>
    </div>
  );
}
