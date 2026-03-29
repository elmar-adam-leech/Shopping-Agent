import { useState, useCallback } from "react";
import { useRoute } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { CartPanel } from "@/components/chat/cart-panel";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { PreferencesPanel } from "@/components/chat/PreferencesPanel";
import { ChatEmptyState } from "@/components/chat/ChatEmptyState";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { useSession } from "@/hooks/use-session";
import { useChatOrchestration, messageKey } from "@/hooks/use-chat-orchestration";
import { useCartStore } from "@/store/use-cart-store";
import { useListConversations, useGetPreferences, useUpdatePreferences, deleteConversation, getGetPreferencesQueryKey, type Conversation } from "@workspace/api-client-react";
import { ChatLoadingIndicator } from "@/components/chat/ChatLoadingIndicator";
import { Sparkles, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef } from "react";

export default function ChatPage() {
  const [, params] = useRoute("/:storeDomain/chat");
  const storeDomain = params?.storeDomain || "";
  const { sessionId } = useSession(storeDomain);
  const cartStore = useCartStore();
  const { toast } = useToast();

  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [showPrefs, setShowPrefs] = useState(false);
  const [convOffset, setConvOffset] = useState(0);
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);

  const CONV_PAGE_SIZE = 50;
  const convParams = { sessionId: sessionId || "", limit: String(CONV_PAGE_SIZE), offset: String(convOffset) };
  const conversationsResult = useListConversations(storeDomain, convParams);
  const refetchConversations = conversationsResult.refetch;

  useEffect(() => {
    if (conversationsResult.data) {
      const newData = conversationsResult.data;
      if (convOffset === 0) {
        setAllConversations(newData);
      } else {
        setAllConversations(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const unique = newData.filter(c => !existingIds.has(c.id));
          return [...prev, ...unique];
        });
      }
    }
  }, [conversationsResult.data, convOffset]);

  const conversations = sessionId ? allConversations : undefined;
  const hasMoreConversations = (conversationsResult.data?.length ?? 0) >= CONV_PAGE_SIZE;

  const loadMoreConversations = useCallback(() => {
    setConvOffset(prev => prev + CONV_PAGE_SIZE);
  }, []);

  const {
    displayMessages,
    isLoading,
    input,
    setInput,
    messagesEndRef,
    handleSubmit,
    loadMessages,
    messages,
    error,
  } = useChatOrchestration({
    storeDomain,
    sessionId: sessionId || "",
    conversationId: activeConversationId,
    cartStore,
    onConversationId: (id) => setActiveConversationId(id),
    onSuccess: () => { setConvOffset(0); refetchConversations(); },
    onCartError: (msg) => toast({ title: "Cart Error", description: msg, variant: "destructive" }),
  });

  const prevErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      toast({ title: "Chat Error", description: error, variant: "destructive" });
    }
    prevErrorRef.current = error;
  }, [error, toast]);

  const prefsParams = { sessionId: sessionId || "" };
  const { data: prefsData } = useGetPreferences(storeDomain, prefsParams, {
    query: { queryKey: getGetPreferencesQueryKey(storeDomain, prefsParams), staleTime: 30_000 },
  });
  const { mutateAsync: updatePrefs } = useUpdatePreferences();
  const userPrefs: Record<string, string> = prefsData?.prefs
    ? Object.fromEntries(Object.entries(prefsData.prefs).map(([k, v]) => [k, String(v ?? "")]))
    : {};

  const handlePrefChange = useCallback(async (key: string, value: string) => {
    if (!sessionId) return;
    try {
      await updatePrefs({ storeDomain, data: { sessionId, prefs: { ...userPrefs, [key]: value } } });
    } catch {
      toast({ title: "Failed to update preference", description: "Please try again.", variant: "destructive" });
    }
  }, [sessionId, storeDomain, updatePrefs, userPrefs, toast]);

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setConvOffset(0);
    loadMessages([]);
  }, [loadMessages]);

  const selectConversation = useCallback((conv: Conversation) => {
    setActiveConversationId(conv.id);
    loadMessages(conv.messages || []);
  }, [loadMessages]);

  const handleDeleteConversation = useCallback(async (convId: number) => {
    try {
      await deleteConversation(storeDomain, convId, {
        headers: { 'x-session-id': sessionId || '' },
      });
      if (activeConversationId === convId) startNewConversation();
      setConvOffset(0);
      refetchConversations();
    } catch {
      toast({ title: "Failed to delete conversation", description: "Please try again.", variant: "destructive" });
    }
  }, [storeDomain, sessionId, activeConversationId, startNewConversation, refetchConversations, toast]);

  if (!sessionId) {
    return (
      <AppLayout storeDomain={storeDomain}>
        <div className="flex h-full items-center justify-center" role="status" aria-label="Loading">
          <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
          <span className="sr-only">Loading chat...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout storeDomain={storeDomain}>
      <div className="flex h-full relative overflow-hidden">
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onNewConversation={startNewConversation}
          onSelectConversation={selectConversation}
          onDeleteConversation={handleDeleteConversation}
          hasMore={hasMoreConversations}
          onLoadMore={loadMoreConversations}
        />

        <div className="flex-1 flex flex-col h-full bg-background/50 relative z-10">
          <div className="h-16 border-b border-border/50 flex items-center justify-between px-6 bg-background/80 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-sm">Shopping Assistant</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowPrefs(!showPrefs)} className="rounded-lg" title="Preferences" aria-label="Toggle preferences" aria-expanded={showPrefs}>
              <Settings2 className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>

          {showPrefs && <PreferencesPanel userPrefs={userPrefs} onPrefChange={handlePrefChange} />}

          <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-32">
            {messages.length === 0 ? (
              <ChatEmptyState storeDomain={storeDomain} onPresetClick={setInput} />
            ) : (
              <div className="max-w-4xl mx-auto space-y-6" role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions">
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

        <CartPanel />
      </div>
    </AppLayout>
  );
}
