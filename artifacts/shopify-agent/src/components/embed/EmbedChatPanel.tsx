import { useState } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { useSession } from "@/hooks/use-session";
import { useChatOrchestration, messageKey } from "@/hooks/use-chat-orchestration";
import { ChatLoadingIndicator } from "@/components/chat/ChatLoadingIndicator";
import { Sparkles, Loader2 } from "lucide-react";

interface EmbedChatPanelProps {
  storeDomain: string;
  productHandle?: string;
  collectionHandle?: string;
  cartToken?: string;
  initialMessage?: string;
}

export function EmbedChatPanel({
  storeDomain,
  productHandle,
  collectionHandle,
  cartToken,
  initialMessage,
}: EmbedChatPanelProps) {
  const { sessionId } = useSession(storeDomain);
  const [conversationId, setConversationId] = useState<number | null>(null);

  const context = productHandle || collectionHandle || cartToken
    ? { productHandle, collectionHandle, cartToken }
    : undefined;

  const {
    displayMessages,
    isLoading,
    input,
    setInput,
    messagesEndRef,
    handleSubmit,
    messages,
  } = useChatOrchestration({
    storeDomain,
    sessionId: sessionId || "",
    conversationId,
    context,
    onConversationId: (id) => setConversationId(id),
    autoSendMessage: initialMessage,
  });

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {messages.length === 0 && !isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white mb-4 shadow-lg shadow-primary/20">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold mb-1">How can I help?</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              Ask me anything about our products, sizing, or policies.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {displayMessages.map((msg, i) => (
              <MessageBubble key={messageKey(messages[i], i)} message={msg} />
            ))}
            {isLoading && <ChatLoadingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <ChatComposer input={input} isLoading={isLoading} onInputChange={setInput} onSubmit={handleSubmit} />
    </div>
  );
}
