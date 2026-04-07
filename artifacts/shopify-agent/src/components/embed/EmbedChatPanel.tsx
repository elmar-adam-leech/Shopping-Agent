import { useState } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { useSession } from "@/hooks/use-session";
import { useChatOrchestration, messageKey } from "@/hooks/use-chat-orchestration";
import { ChatLoadingIndicator } from "@/components/chat/ChatLoadingIndicator";
import { Sparkles } from "lucide-react";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { useGetStorePublic } from "@workspace/api-client-react";
import { I18nProvider, useI18n } from "@/contexts/i18n-context";

interface EmbedChatPanelProps {
  storeDomain: string;
  productHandle?: string;
  collectionHandle?: string;
  cartToken?: string;
  initialMessage?: string;
}

export function EmbedChatPanel(props: EmbedChatPanelProps) {
  const { data: storePublic } = useGetStorePublic(props.storeDomain);
  const defaultLocale = (storePublic as any)?.defaultLanguage || "en";
  return (
    <I18nProvider defaultLocale={defaultLocale}>
      <EmbedChatPanelInner {...props} />
    </I18nProvider>
  );
}

function EmbedChatPanelInner({
  storeDomain,
  productHandle,
  collectionHandle,
  cartToken,
  initialMessage,
}: EmbedChatPanelProps) {
  const { sessionId, sessionError, chatDisabled, refreshSession } = useSession(storeDomain);
  const { data: storePublic } = useGetStorePublic(storeDomain);
  const { setLocale, t } = useI18n();
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
    handleImageSubmit,
    messages,
    error,
  } = useChatOrchestration({
    storeDomain,
    sessionId: sessionId || "",
    conversationId,
    context,
    onConversationId: (id) => setConversationId(id),
    autoSendMessage: initialMessage,
    onLanguageDetected: setLocale,
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
      <LoadingOverlay
        loadingText="Loading chat..."
        error={sessionError ? "Unable to connect. Please try again." : null}
        onRetry={sessionError ? () => refreshSession() : undefined}
        retryVariant="link"
        retryLabel="Retry"
        className="bg-background"
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-background" role="region" aria-label="AI Shopping Assistant">
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {messages.length === 0 && !isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <AgentAvatar icon={Sparkles} size="lg" variant="gradient" className="mb-4" />
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

      <ChatComposer input={input} isLoading={isLoading} onInputChange={setInput} onSubmit={handleSubmit} onImageSubmit={handleImageSubmit} visionSupported={storePublic?.visionSupported} />
    </div>
  );
}
