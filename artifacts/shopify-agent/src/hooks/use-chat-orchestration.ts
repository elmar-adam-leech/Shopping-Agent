import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage } from "@workspace/api-client-react";
import type { ChatMessageDisplay } from "@/components/chat/MessageBubble";
import { useChatStream, type UseChatStreamOptions } from "@/hooks/use-chat-stream";

export function toChatMessageDisplay(msg: ChatMessage): ChatMessageDisplay {
  const role = msg.role === "user" ? "user" : "assistant";
  return {
    role,
    content: msg.content,
    timestamp: msg.timestamp,
    toolCalls: msg.toolCalls,
    toolResults: msg.toolResults,
  };
}

export function messageKey(msg: ChatMessage, index: number): string {
  if ('_id' in msg && typeof (msg as { _id: unknown })._id === 'string') {
    return (msg as { _id: string })._id;
  }
  return `${msg.timestamp}-${msg.role}-${index}`;
}

interface UseChatOrchestrationOptions extends UseChatStreamOptions {
  autoSendMessage?: string;
}

export function useChatOrchestration(options: UseChatOrchestrationOptions) {
  const { autoSendMessage, ...streamOptions } = options;
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sentInitialRef = useRef(false);

  const chatStream = useChatStream(streamOptions);
  const { messages, isLoading, sendMessage, error } = chatStream;

  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 150);
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [messages]);

  useEffect(() => {
    if (autoSendMessage && options.sessionId && !sentInitialRef.current) {
      sentInitialRef.current = true;
      sendMessage(autoSendMessage);
    }
  }, [autoSendMessage, options.sessionId, sendMessage]);

  const displayMessages: ChatMessageDisplay[] = messages.map(toChatMessageDisplay);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || isLoading) return;
      sendMessage(input);
      setInput("");
    },
    [input, isLoading, sendMessage],
  );

  const handleImageSubmit = useCallback(
    (imageBase64: string, message: string) => {
      if (isLoading) return;
      sendMessage(message, 0, imageBase64);
      setInput("");
    },
    [isLoading, sendMessage],
  );

  return {
    ...chatStream,
    displayMessages,
    input,
    setInput,
    messagesEndRef,
    handleSubmit,
    handleImageSubmit,
    error,
  };
}
