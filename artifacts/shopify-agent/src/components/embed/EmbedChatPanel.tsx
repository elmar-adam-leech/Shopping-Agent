import { useState, useRef, useEffect } from "react";
import { MessageBubble, type ChatMessageDisplay } from "@/components/chat/MessageBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useSession } from "@/hooks/use-session";
import { Sparkles, Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

interface EmbedChatPanelProps {
  storeDomain: string;
  productHandle?: string;
  collectionHandle?: string;
  cartToken?: string;
  initialMessage?: string;
}

export function EmbedChatPanel({
  storeDomain,
  productHandle,
  collectionHandle,
  cartToken,
  initialMessage,
}: EmbedChatPanelProps) {
  const sessionId = useSession(storeDomain);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sentInitialRef = useRef(false);

  const context = productHandle || collectionHandle || cartToken
    ? { productHandle, collectionHandle, cartToken }
    : undefined;

  const { messages, isLoading, sendMessage } = useChatStream({
    storeDomain,
    sessionId: sessionId || "",
    conversationId,
    context,
    onConversationId: (id) => setConversationId(id),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (initialMessage && sessionId && !sentInitialRef.current) {
      sentInitialRef.current = true;
      sendMessage(initialMessage);
    }
  }, [initialMessage, sessionId, sendMessage]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
  };

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {messages.length === 0 && !isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white mb-4 shadow-lg shadow-primary/20">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold mb-1">How can I help?</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              Ask me anything about our products, sizing, or policies.
            </p>
          </div>
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
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <ChatComposer input={input} isLoading={isLoading} onInputChange={setInput} onSubmit={handleSubmit} />
    </div>
  );
}
