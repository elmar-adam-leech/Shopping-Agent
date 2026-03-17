import { useState, useRef, useCallback } from "react";
import type { ChatMessage, ToolCall, ToolResult } from "@workspace/api-client-react";
import { readSSEStream } from "@/lib/sse-parser";

export function useShopForMeChatStream(
  storeDomain: string,
  sessionId: string | null,
  onSessionExpired?: () => Promise<string | null>
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const sendMessage = useCallback(
    async (content: string, retryCount = 0) => {
      const currentSessionId = sessionIdRef.current;
      if (!content.trim() || !currentSessionId || !storeDomain) return;

      if (retryCount === 0) {
        const userMsg: ChatMessage = {
          role: "user",
          content,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMsg]);
      }
      setIsLoading(true);
      abortRef.current = new AbortController();

      try {
        const res = await fetch(`/api/stores/${storeDomain}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: currentSessionId, conversationId, message: content }),
          signal: abortRef.current.signal,
        });

        if ((res.status === 401 || res.status === 403) && retryCount < 1 && onSessionExpired) {
          const newSessionId = await onSessionExpired();
          if (newSessionId) {
            setConversationId(null);
            return sendMessage(content, retryCount + 1);
          }
        }

        if (!res.ok || !res.body) throw new Error("Chat request failed");

        let assistantContent = "";
        let toolCalls: ToolCall[] = [];
        let toolResults: ToolResult[] = [];

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "", timestamp: new Date().toISOString() },
        ]);

        await readSSEStream(
          res.body,
          (event) => {
            if (event.type === "text") {
              assistantContent += event.data as string;
            } else if (event.type === "conversation_id") {
              setConversationId(event.data as number);
            } else if (event.type === "tool_call") {
              const d = event.data as { id: string; name: string; arguments: string };
              toolCalls = [...toolCalls, { id: d.id, name: d.name, arguments: d.arguments }];
            } else if (event.type === "tool_result") {
              const d = event.data as { toolCallId: string; content: string };
              toolResults = [...toolResults, { toolCallId: d.toolCallId, content: d.content }];
            }

            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: assistantContent,
                toolCalls: toolCalls.length > 0 ? [...toolCalls] : undefined,
                toolResults: toolResults.length > 0 ? [...toolResults] : undefined,
              };
              return updated;
            });
          },
          abortRef.current.signal
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Sorry, something went wrong. Please try again.", timestamp: new Date().toISOString() },
          ]);
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [storeDomain, conversationId, onSessionExpired]
  );

  return { messages, isLoading, sendMessage };
}
