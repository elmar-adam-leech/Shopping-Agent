import { useState } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { useSession } from "@/hooks/use-session";
import { useChatOrchestration, messageKey } from "@/hooks/use-chat-orchestration";
import { ChatLoadingIndicator } from "@/components/chat/ChatLoadingIndicator";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";

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
  const { sessionId, sessionError, chatDisabled, refreshSession } = useSession(storeDomain);
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
    error,
  } = useChatOrchestration({
    storeDomain,
    sessionId: sessionId || "",
    conversationId,
    context,
    onConversationId: (id) => setConversationId(id),
    autoSendMessage: initialMessage,
  });

  if (chatDisabled) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-4">
        <p className="text-muted-foreground text-sm">Chat is currently unavailable.</p>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center bg-background" role="status" aria-label="Loading">
        {sessionError ? (
          <div className="text-center space-y-3 p-4">
            <p className="text-muted-foreground text-sm">Unable to connect. Please try again.</p>
            <button
              onClick={() => refreshSession()}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        ) : (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
            <span className="sr-only">Loading chat...</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background" role="region" aria-label="AI Shopping Assistant">
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {messages.length === 0 && !isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white mb-4 shadow-lg shadow-primary/20" aria-hidden="true">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold mb-1">How can I help?</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              Ask me anything about our products, sizing, or policies.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6" role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions">
            {displayMessages.map((msg, i) => (
              <MessageBubble key={messageKey(messages[i], i)} message={msg} />
            ))}
            {isLoading && <ChatLoadingIndicator />}
            {error && !isLoading && (
              <div className="text-center py-2">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <ChatComposer input={input} isLoading={isLoading} onInputChange={setInput} onSubmit={handleSubmit} />
    </div>
  );
}
