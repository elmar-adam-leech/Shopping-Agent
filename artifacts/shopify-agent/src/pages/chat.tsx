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
import { ChatLoadingIndicator } from "@/components/chat/ChatLoadingIndicator";
import { Sparkles, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function ChatPage() {
  const [, params] = useRoute("/:storeDomain/chat");
  const storeDomain = params?.storeDomain || "";
  const { sessionId } = useSession(storeDomain);
  const cartStore = useCartStore();
  const { toast } = useToast();

  const [input, setInput] = useState("");
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [showPrefs, setShowPrefs] = useState(false);
  const [convOffset, setConvOffset] = useState(0);
  const [allConversations, setAllConversations] = useState<Array<{ id: number; title: string; messages: ChatMessageDisplay[]; updatedAt: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const CONV_PAGE_SIZE = 50;
  const conversationsResult = useListConversations(storeDomain, { sessionId: sessionId || "", limit: String(CONV_PAGE_SIZE), offset: String(convOffset) } as { sessionId: string });
  const refetchConversations = conversationsResult.refetch;

  useEffect(() => {
    if (conversationsResult.data) {
      const newData = conversationsResult.data as Array<{ id: number; title: string; messages: ChatMessageDisplay[]; updatedAt: string }>;
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

  const { messages, isLoading, sendMessage, loadMessages } = useChatStream({
    storeDomain,
    sessionId: sessionId || "",
    conversationId: activeConversationId,
    cartStore,
    onConversationId: (id) => setActiveConversationId(id),
    onSuccess: () => { setConvOffset(0); refetchConversations(); },
    onCartError: (msg) => toast({ title: "Cart Error", description: msg, variant: "destructive" }),
  });

  const { data: prefsData } = useGetPreferences(storeDomain, { sessionId: sessionId || "" });
  const { mutateAsync: updatePrefs } = useUpdatePreferences();
  const userPrefs = (prefsData?.prefs || {}) as Record<string, string>;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handlePrefChange = useCallback(async (key: string, value: string) => {
    if (!sessionId) return;
    try {
      await updatePrefs({ storeDomain, data: { sessionId, prefs: { ...userPrefs, [key]: value } } });
    } catch {
      toast({ title: "Failed to update preference", description: "Please try again.", variant: "destructive" });
    }
  }, [sessionId, storeDomain, updatePrefs, userPrefs, toast]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
  }, [input, isLoading, sendMessage]);

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setConvOffset(0);
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
      setConvOffset(0);
      refetchConversations();
    } catch {
      toast({ title: "Failed to delete conversation", description: "Please try again.", variant: "destructive" });
    }
  }, [storeDomain, sessionId, activeConversationId, startNewConversation, refetchConversations, toast]);

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
