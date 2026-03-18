import { useState, useRef, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { CartPanel } from "@/components/chat/cart-panel";
import { MessageBubble, type ChatMessageDisplay } from "@/components/chat/MessageBubble";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { PreferencesPanel } from "@/components/chat/PreferencesPanel";
import { ChatEmptyState } from "@/components/chat/ChatEmptyState";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { useSession } from "@/hooks/use-session";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useCartStore } from "@/store/use-cart-store";
import { useListConversations, useGetPreferences, useUpdatePreferences, deleteConversation } from "@workspace/api-client-react";
import { Sparkles, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";

export default function ChatPage() {
  const [, params] = useRoute("/:storeDomain/chat");
  const storeDomain = params?.storeDomain || "";
  const { sessionId } = useSession(storeDomain);
  const cartStore = useCartStore();

  const [input, setInput] = useState("");
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [showPrefs, setShowPrefs] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversationsResult = useListConversations(storeDomain, { sessionId: sessionId || "" });
  const conversations = sessionId ? conversationsResult.data : undefined;
  const refetchConversations = conversationsResult.refetch;

  const { messages, isLoading, sendMessage, loadMessages } = useChatStream({
    storeDomain,
    sessionId: sessionId || "",
    conversationId: activeConversationId,
    cartStore,
    onConversationId: (id) => setActiveConversationId(id),
    onSuccess: () => refetchConversations()
  });

  const { data: prefsData } = useGetPreferences(storeDomain, { sessionId: sessionId || "" });
  const { mutateAsync: updatePrefs } = useUpdatePreferences();
  const userPrefs = (prefsData?.prefs || {}) as Record<string, string>;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handlePrefChange = useCallback(async (key: string, value: string) => {
    if (!sessionId) return;
    await updatePrefs({ storeDomain, data: { sessionId, prefs: { ...userPrefs, [key]: value } } });
  }, [sessionId, storeDomain, updatePrefs, userPrefs]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
  }, [input, isLoading, sendMessage]);

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    loadMessages([]);
  }, [loadMessages]);

  const selectConversation = useCallback((conv: { id: number; messages: ChatMessageDisplay[] }) => {
    setActiveConversationId(conv.id);
    loadMessages(conv.messages || []);
  }, [loadMessages]);

  const handleDeleteConversation = useCallback(async (convId: number) => {
    try {
      await deleteConversation(storeDomain, convId, {
        headers: { 'x-session-id': sessionId || '' },
      });
      if (activeConversationId === convId) startNewConversation();
      refetchConversations();
    } catch (err) {
      console.error("Failed to delete conversation", err);
    }
  }, [storeDomain, sessionId, activeConversationId, startNewConversation, refetchConversations]);

  if (!sessionId) {
    return (
      <AppLayout storeDomain={storeDomain}>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout storeDomain={storeDomain}>
      <div className="flex h-full relative overflow-hidden">
        <ConversationSidebar
          conversations={conversations as Array<{ id: number; title: string; messages: ChatMessageDisplay[]; updatedAt: string }> | undefined}
          activeConversationId={activeConversationId}
          onNewConversation={startNewConversation}
          onSelectConversation={selectConversation}
          onDeleteConversation={handleDeleteConversation}
        />

        <div className="flex-1 flex flex-col h-full bg-background/50 relative z-10">
          <div className="h-16 border-b border-border/50 flex items-center justify-between px-6 bg-background/80 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-sm">Shopping Assistant</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowPrefs(!showPrefs)} className="rounded-lg" title="Preferences">
              <Settings2 className="w-4 h-4" />
            </Button>
          </div>

          {showPrefs && <PreferencesPanel userPrefs={userPrefs} onPrefChange={handlePrefChange} />}

          <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-32">
            {messages.length === 0 ? (
              <ChatEmptyState storeDomain={storeDomain} onPresetClick={setInput} />
            ) : (
              <div className="max-w-4xl mx-auto space-y-6">
                {messages.map((msg, i) => (
                  <MessageBubble key={i} message={msg as ChatMessageDisplay} />
                ))}
                {isLoading && (
                  <div className="flex gap-4 max-w-[85%]">
                    <Avatar className="w-10 h-10 border border-primary/20 bg-primary/5 flex items-center justify-center text-primary">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </Avatar>
                    <div className="flex items-center text-sm text-muted-foreground bg-secondary/30 px-4 py-3 rounded-2xl rounded-tl-sm">
                      Agent is thinking...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <ChatComposer input={input} isLoading={isLoading} onInputChange={setInput} onSubmit={handleSubmit} />
        </div>

        <CartPanel />
      </div>
    </AppLayout>
  );
}
