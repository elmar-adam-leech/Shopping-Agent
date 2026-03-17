import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, ToolCall, ToolResult } from '@workspace/api-client-react';
import { useCartStore } from '@/store/use-cart-store';

interface UseChatStreamProps {
  storeDomain: string;
  sessionId: string;
  conversationId?: number | null;
  onSuccess?: () => void;
}

export function useChatStream({ storeDomain, sessionId, conversationId, onSuccess }: UseChatStreamProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cartStore = useCartStore();

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !sessionId || !storeDomain) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/stores/${storeDomain}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          conversationId,
          message: content
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      if (!response.body) throw new Error('No response body stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let assistantMessage = '';
      let currentToolCalls: ToolCall[] = [];
      let currentToolResults: ToolResult[] = [];

      // Add placeholder assistant message
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: '', timestamp: new Date().toISOString() }
      ]);

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6).trim();
              if (dataStr === '[DONE]') continue;
              
              try {
                const event = JSON.parse(dataStr);
                
                if (event.type === 'text') {
                  assistantMessage += event.data;
                } else if (event.type === 'conversation_id') {
                  // conversation ID received from backend
                } else if (event.type === 'tool_call') {
                  currentToolCalls.push({
                    id: event.data.id,
                    name: event.data.name,
                    arguments: event.data.arguments
                  });
                  
                  if (event.data.name === 'add_to_cart') {
                    try {
                      const args = JSON.parse(event.data.arguments);
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
                  currentToolResults.push({
                    toolCallId: event.data.toolCallId,
                    content: event.data.content
                  });
                }
                
                // Update the last message
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
              } catch (e) {
                console.warn('Failed to parse SSE line:', dataStr);
              }
            }
          }
        }
      }
      
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
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [storeDomain, sessionId, conversationId, cartStore, onSuccess]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  // Hydrate initial messages
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
