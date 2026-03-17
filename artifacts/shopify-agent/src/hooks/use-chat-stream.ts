import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage, ToolCall, ToolResult } from '@workspace/api-client-react';
import { useCartStore } from '@/store/use-cart-store';
import { readSSEStream } from '@/lib/sse-parser';

interface ChatContext {
  productHandle?: string;
  collectionHandle?: string;
  cartToken?: string;
  searchMode?: boolean;
}

interface UseChatStreamProps {
  storeDomain: string;
  sessionId: string;
  conversationId?: number | null;
  context?: ChatContext;
  onConversationId?: (id: number) => void;
  onSuccess?: () => void;
}

export function useChatStream({ storeDomain, sessionId, conversationId, context, onConversationId, onSuccess }: UseChatStreamProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cartStore = useCartStore();

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !sessionId || !storeDomain) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
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
          sessionId,
          conversationId,
          message: content,
          ...(context ? { context } : {}),
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      if (!response.body) throw new Error('No response body stream');

      let assistantMessage = '';
      let currentToolCalls: ToolCall[] = [];
      let currentToolResults: ToolResult[] = [];

      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: '', timestamp: new Date().toISOString() }
      ]);

      await readSSEStream(
        response.body,
        (event) => {
          if (event.type === 'text') {
            assistantMessage += event.data as string;
          } else if (event.type === 'conversation_id') {
            onConversationId?.(event.data as number);
          } else if (event.type === 'tool_call') {
            const d = event.data as { id: string; name: string; arguments: string };
            currentToolCalls.push({ id: d.id, name: d.name, arguments: d.arguments });

            if (d.name === 'add_to_cart') {
              try {
                const args = JSON.parse(d.arguments);
                cartStore.addItem({
                  id: args.variantId || args.productId || `tmp-${Date.now()}`,
                  title: args.title || 'Item added',
                  price: parseFloat(args.price || '0'),
                  imageUrl: args.imageUrl
                });
              } catch (e) {
                console.error('Failed to parse add_to_cart arguments', e);
              }
            }
          } else if (event.type === 'tool_result') {
            const d = event.data as { toolCallId: string; content: string };
            currentToolResults.push({ toolCallId: d.toolCallId, content: d.content });
          }

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
        },
        controller.signal
      );
      
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message || 'An error occurred');
        console.error('Chat error:', err);
      } else if (!(err instanceof Error)) {
        setError('An error occurred');
        console.error('Chat error:', err);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [storeDomain, sessionId, conversationId, context, cartStore, onConversationId, onSuccess]);

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
    loadMessages
  };
}
