import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage, ToolCall, ToolResult } from '@workspace/api-client-react';
import { readSSEStream } from '@/lib/sse-parser';

interface ChatContext {
  productHandle?: string;
  collectionHandle?: string;
  cartToken?: string;
  searchMode?: boolean;
}

interface CartStoreActions {
  addItem: (item: { id: string; title: string; price: number; imageUrl?: string }) => void;
}

interface UseChatStreamOptions {
  storeDomain: string;
  sessionId: string | null;
  conversationId?: number | null;
  context?: ChatContext;
  cartStore?: CartStoreActions;
  onConversationId?: (id: number) => void;
  onSuccess?: () => void;
  onSessionExpired?: () => Promise<string | null>;
}

export function useChatStream({
  storeDomain,
  sessionId,
  conversationId: externalConversationId,
  context,
  cartStore,
  onConversationId,
  onSuccess,
  onSessionExpired,
}: UseChatStreamOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalConversationId, setInternalConversationId] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const conversationId = externalConversationId !== undefined ? externalConversationId : internalConversationId;

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const sendMessage = useCallback(async (content: string, retryCount = 0) => {
    const currentSessionId = sessionIdRef.current;
    if (!content.trim() || !currentSessionId || !storeDomain) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    if (retryCount === 0) {
      const userMessage: ChatMessage = {
        role: 'user',
        content,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMessage]);
    }
    setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (context) {
        headers['x-embed-mode'] = 'true';
      }

      const response = await fetch(`/api/stores/${storeDomain}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: currentSessionId,
          conversationId,
          message: content,
          ...(context ? { context } : {}),
        }),
        signal: controller.signal
      });

      if ((response.status === 401 || response.status === 403) && retryCount < 1 && onSessionExpired) {
        const newSessionId = await onSessionExpired();
        if (newSessionId) {
          setInternalConversationId(null);
          return sendMessage(content, retryCount + 1);
        }
      }

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      if (!response.body) throw new Error('No response body stream');

      let assistantMessage = '';
      let currentToolCalls: ToolCall[] = [];
      let currentToolResults: ToolResult[] = [];
      let streamDirty = false;

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '', timestamp: new Date().toISOString() }
      ]);

      const flushStreamUpdate = () => {
        if (!streamDirty) return;
        streamDirty = false;
        setMessages(prev => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          newMessages[lastIndex] = {
            ...newMessages[lastIndex],
            content: assistantMessage,
            toolCalls: currentToolCalls.length > 0 ? [...currentToolCalls] : undefined,
            toolResults: currentToolResults.length > 0 ? [...currentToolResults] : undefined
          };
          return newMessages;
        });
      };

      const throttleInterval = setInterval(flushStreamUpdate, 100);

      try {
        await readSSEStream(
          response.body,
          (event) => {
            if (event.type === 'text') {
              assistantMessage += event.data as string;
              streamDirty = true;
            } else if (event.type === 'conversation_id') {
              const id = event.data as number;
              onConversationId?.(id);
              setInternalConversationId(id);
            } else if (event.type === 'tool_call') {
              const d = event.data as { id: string; name: string; arguments: string };
              currentToolCalls = [...currentToolCalls, { id: d.id, name: d.name, arguments: d.arguments }];
              streamDirty = true;

              if (d.name === 'add_to_cart' && cartStore) {
                try {
                  const args = JSON.parse(d.arguments);
                  cartStore.addItem({
                    id: args.variantId || args.productId || `tmp-${Date.now()}`,
                    title: args.title || 'Item added',
                    price: parseFloat(args.price || '0'),
                    imageUrl: args.imageUrl
                  });
                } catch (e) {
                  console.warn('[useChatStream] Failed to parse add_to_cart arguments:', e);
                }
              }
            } else if (event.type === 'tool_result') {
              const d = event.data as { toolCallId: string; content: string };
              currentToolResults = [...currentToolResults, { toolCallId: d.toolCallId, content: d.content }];
              streamDirty = true;
            }
          },
          controller.signal
        );
      } finally {
        clearInterval(throttleInterval);
        flushStreamUpdate();
      }

      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.warn('[useChatStream] Chat error:', err);

      if (onSessionExpired && !onConversationId) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Sorry, something went wrong. Please try again.', timestamp: new Date().toISOString() }
        ]);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [storeDomain, conversationId, context, cartStore, onConversationId, onSuccess, onSessionExpired]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  const loadMessages = useCallback((initialMessages: ChatMessage[]) => {
    setMessages(initialMessages);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    stopGeneration,
    loadMessages,
    conversationId: internalConversationId,
  };
}
