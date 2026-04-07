import { useState, useCallback } from "react";
import { useRoute } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { CartPanel } from "@/components/chat/cart-panel";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { PreferencesPanel } from "@/components/chat/PreferencesPanel";
import { MemoryPanel } from "@/components/chat/MemoryPanel";
import { ChatEmptyState } from "@/components/chat/ChatEmptyState";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { CustomerAccountConnect } from "@/components/chat/CustomerAccountConnect";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { PrivacySettingsPanel } from "@/components/consent/PrivacySettingsPanel";
import { CheckoutRecoveryCard } from "@/components/chat/CheckoutRecoveryCard";
import { ChatActionsProvider, type QuickAddProduct } from "@/contexts/chat-actions-context";
import { I18nProvider, useI18n } from "@/contexts/i18n-context";
import { useSession } from "@/hooks/use-session";
import { useChatOrchestration, messageKey } from "@/hooks/use-chat-orchestration";
import { useCartStore } from "@/store/use-cart-store";
import { useListConversations, useListDeletedConversations, restoreConversation, useGetPreferences, useUpdatePreferences, deleteConversation, getGetPreferencesQueryKey, useGetStorePublic, useCheckAbandonedCheckout, useCheckoutRecoveryAction, getCheckAbandonedCheckoutQueryKey, type Conversation } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ChatLoadingIndicator } from "@/components/chat/ChatLoadingIndicator";
import { Sparkles, Settings2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { useEffect, useRef } from "react";

export default function ChatPage() {
  const [, params] = useRoute("/:storeDomain/chat");
  const storeDomain = params?.storeDomain || "";
  const { data: storePublic } = useGetStorePublic(storeDomain);
  const defaultLocale = (storePublic as any)?.defaultLanguage || "en";

  return (
    <I18nProvider defaultLocale={defaultLocale}>
      <ChatPageContent storeDomain={storeDomain} />
    </I18nProvider>
  );
}

function ChatPageContent({ storeDomain }: { storeDomain: string }) {
  const { sessionId, sessionError, chatDisabled, refreshSession } = useSession(storeDomain);
  const cartStore = useCartStore();
  const { toast } = useToast();
  const { data: storePublic } = useGetStorePublic(storeDomain);
  const { setLocale, t } = useI18n();
  const queryClient = useQueryClient();

  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [showPrefs, setShowPrefs] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [convOffset, setConvOffset] = useState(0);
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);

  const CONV_PAGE_SIZE = 50;
  const convParams = { sessionId: sessionId || "", limit: String(CONV_PAGE_SIZE), offset: String(convOffset) };
  const conversationsResult = useListConversations(storeDomain, convParams);
  const refetchConversations = conversationsResult.refetch;
  const deletedConvParams = { sessionId: sessionId || "" };
  const deletedConvsResult = useListDeletedConversations(storeDomain, deletedConvParams);
  const refetchDeletedConversations = deletedConvsResult.refetch;

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

  const handlePreferencesUpdated = useCallback(() => {
    const prefsQueryKey = getGetPreferencesQueryKey(storeDomain, { sessionId: sessionId || "" });
    queryClient.invalidateQueries({ queryKey: prefsQueryKey });
  }, [storeDomain, sessionId, queryClient]);

  const {
    displayMessages,
    isLoading,
    input,
    setInput,
    messagesEndRef,
    handleSubmit,
    handleImageSubmit,
    loadMessages,
    messages,
    error,
    sendMessage,
  } = useChatOrchestration({
    storeDomain,
    sessionId: sessionId || "",
    conversationId: activeConversationId,
    cartStore,
    onConversationId: (id) => setActiveConversationId(id),
    onSuccess: () => { setConvOffset(0); refetchConversations(); },
    onCartError: (msg) => toast({ title: "Cart Error", description: msg, variant: "destructive" }),
    onPreferencesUpdated: handlePreferencesUpdated,
    onLanguageDetected: setLocale,
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

  const handlePrefDelete = useCallback(async (key: string) => {
    if (!sessionId) return;
    try {
      const newPrefs = { ...userPrefs };
      delete newPrefs[key];
      await updatePrefs({ storeDomain, data: { sessionId, prefs: newPrefs } });
    } catch {
      toast({ title: "Failed to delete preference", description: "Please try again.", variant: "destructive" });
    }
  }, [sessionId, storeDomain, updatePrefs, userPrefs, toast]);

  const quickAddToCart = useCallback(async (product: QuickAddProduct) => {
    if (!sessionId) throw new Error("No session");

    const response = await fetch(
      `/api/stores/${storeDomain}/cart/quick-add`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({
          variantId: product.variantId,
          quantity: 1,
        }),
      },
    );

    if (!response.ok) {
      let msg = "Failed to add to cart";
      try {
        const body = await response.json();
        if (body?.error) msg = body.error;
      } catch {
        // ignore parse error
      }
      throw new Error(msg);
    }

    cartStore.addItem({
      id: product.variantId,
      title: product.title,
      price: product.price,
      imageUrl: product.imageUrl,
      variantId: product.variantId,
    });
  }, [sessionId, storeDomain, cartStore]);

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setConvOffset(0);
    loadMessages([]);
  }, [loadMessages]);

  const recoveryParams = { sessionId: sessionId || "" };
  const recoveryQueryKey = getCheckAbandonedCheckoutQueryKey(storeDomain, recoveryParams);
  const { data: recoveryData } = useCheckAbandonedCheckout(storeDomain, recoveryParams, {
    query: {
      queryKey: recoveryQueryKey,
      enabled: !!sessionId && !recoveryDismissed && messages.length === 0,
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  });
  const { mutateAsync: recoveryAction } = useCheckoutRecoveryAction();

  const handleRecoveryResume = useCallback(() => {
    if (!sessionId) return;
    recoveryAction({ storeDomain, data: { sessionId, action: "resumed" } }).catch(() => {});
    const itemsSummary = recoveryData?.cartItems?.map(i => i.title).join(", ") || "my previous items";
    setInput(`I'd like to resume my checkout with ${itemsSummary}. Can you help me complete my purchase?`);
    setRecoveryDismissed(true);
  }, [sessionId, storeDomain, recoveryAction, recoveryData, setInput]);

  const handleRecoveryDismiss = useCallback(() => {
    if (!sessionId) return;
    recoveryAction({ storeDomain, data: { sessionId, action: "dismissed" } }).catch(() => {});
    setRecoveryDismissed(true);
  }, [sessionId, storeDomain, recoveryAction]);

  const handleRecoveryStartFresh = useCallback(() => {
    if (!sessionId) return;
    recoveryAction({ storeDomain, data: { sessionId, action: "dismissed", metadata: { reason: "start_fresh" } } }).catch(() => {});
    setRecoveryDismissed(true);
    startNewConversation();
  }, [sessionId, storeDomain, recoveryAction, startNewConversation]);

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
      refetchDeletedConversations();
    } catch {
      toast({ title: "Failed to delete conversation", description: "Please try again.", variant: "destructive" });
    }
  }, [storeDomain, sessionId, activeConversationId, startNewConversation, refetchConversations, refetchDeletedConversations, toast]);

  const handleRestoreConversation = useCallback(async (convId: number) => {
    try {
      await restoreConversation(storeDomain, convId, {
        headers: { 'x-session-id': sessionId || '' },
      });
      setConvOffset(0);
      refetchConversations();
      refetchDeletedConversations();
    } catch {
      toast({ title: "Failed to restore conversation", description: "Please try again.", variant: "destructive" });
    }
  }, [storeDomain, sessionId, refetchConversations, refetchDeletedConversations, toast]);

  if (chatDisabled) {
    return (
      <AppLayout storeDomain={storeDomain}>
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">{t.chatDisabled}</p>
        </div>
      </AppLayout>
    );
  }

  if (!sessionId) {
    return (
      <AppLayout storeDomain={storeDomain}>
        <LoadingOverlay
          loadingText="Loading chat..."
          error={sessionError ? "Unable to connect to the chat service." : null}
          onRetry={sessionError ? () => refreshSession() : undefined}
        />
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
          deletedConversations={deletedConvsResult.data as any}
          onRestoreConversation={handleRestoreConversation}
        />

        <ChatActionsProvider sendMessage={sendMessage} quickAddToCart={quickAddToCart} isLoading={isLoading}>
          <div className="flex-1 flex flex-col h-full bg-background/50 relative z-10">
            <div className="min-h-[56px] border-b border-border/50 flex items-center justify-between px-4 sm:px-6 bg-background/80 backdrop-blur-md sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <AgentAvatar icon={Sparkles} size="sm" />
                <h2 className="font-bold text-sm">{t.shoppingAssistant}</h2>
              </div>
              <div className="flex items-center gap-2">
                {sessionId && <CustomerAccountConnect storeDomain={storeDomain} sessionId={sessionId} />}
                <Button variant="ghost" size="icon" onClick={() => { setShowPrivacy(!showPrivacy); if (!showPrivacy) setShowPrefs(false); }} className="rounded-lg" title="Privacy settings" aria-label="Toggle privacy settings" aria-expanded={showPrivacy}>
                  <Shield className="w-4 h-4" aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { setShowPrefs(!showPrefs); if (!showPrefs) setShowPrivacy(false); }} className="rounded-lg" title="Preferences" aria-label="Toggle preferences" aria-expanded={showPrefs}>
                  <Settings2 className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {showPrivacy && <PrivacySettingsPanel storeDomain={storeDomain} sessionId={sessionId} onClose={() => setShowPrivacy(false)} />}
            {showPrefs && <PreferencesPanel userPrefs={userPrefs} onPrefChange={handlePrefChange} />}

            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-32">
              {recoveryData?.hasAbandonedCheckout && !recoveryDismissed && messages.length === 0 && (
                <CheckoutRecoveryCard
                  cartItems={recoveryData.cartItems ?? []}
                  cartTotal={recoveryData.cartTotal ?? 0}
                  abandonedAt={recoveryData.abandonedAt ?? new Date().toISOString()}
                  onResume={handleRecoveryResume}
                  onDismiss={handleRecoveryDismiss}
                  onStartFresh={handleRecoveryStartFresh}
                />
              )}
              {messages.length === 0 ? (
                <ChatEmptyState storeDomain={storeDomain} onPresetClick={setInput} welcomeMessage={storePublic?.welcomeMessage} />
              ) : (
                <div className="max-w-4xl mx-auto space-y-6" role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions">
                  <MemoryPanel userPrefs={userPrefs} onPrefChange={handlePrefChange} onPrefDelete={handlePrefDelete} />
                  {displayMessages.map((msg, i) => (
                    <MessageBubble
                      key={messageKey(messages[i], i)}
                      message={msg}
                      feedbackProps={{
                        storeDomain,
                        sessionId,
                        conversationId: activeConversationId,
                      }}
                    />
                  ))}
                  {isLoading && <ChatLoadingIndicator />}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <ChatComposer
              input={input}
              isLoading={isLoading}
              onInputChange={setInput}
              onSubmit={handleSubmit}
              onImageSubmit={handleImageSubmit}
              visionSupported={storePublic?.visionSupported}
            />
          </div>

          <CartPanel />
        </ChatActionsProvider>

        <ConsentBanner storeDomain={storeDomain} sessionId={sessionId} />
      </div>
    </AppLayout>
  );
}
