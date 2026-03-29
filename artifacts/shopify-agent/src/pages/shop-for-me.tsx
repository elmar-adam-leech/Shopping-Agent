import { useState, useRef, useEffect, useCallback } from "react";
import { useRoute, useSearch } from "wouter";
import { ChatLoadingIndicator } from "@/components/chat/ChatLoadingIndicator";
import { Send, Sparkles, Loader2, ShoppingBag } from "lucide-react";
import type { ToolCall } from "@workspace/api-client-react";
import { useSession } from "@/hooks/use-session";
import { useChatStream } from "@/hooks/use-chat-stream";
import { ToolBadge } from "@/components/shop-for-me/ToolBadge";
import { MarkdownContent } from "@/components/ui/markdown-content";

interface StorePublicInfo {
  storeDomain: string;
  chatEnabled: boolean;
}

function formatStoreName(domain: string): string {
  return domain.replace(/\.myshopify\.com$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ShopForMePage() {
  const [, params] = useRoute("/shop/:storeDomain");
  const storeDomain = params?.storeDomain || "";
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const isEmbed = searchParams.get("embed") === "true";

  const [storeInfo, setStoreInfo] = useState<StorePublicInfo | null>(null);
  const [storeNotFound, setStoreNotFound] = useState(false);
  const { sessionId, chatDisabled, refreshSession } = useSession(storeDomain, {
    storageKeyPrefix: 'shop_for_me_session_',
    ttlMs: 23 * 60 * 60 * 1000,
  });
  const { messages, isLoading, sendMessage } = useChatStream({
    storeDomain,
    sessionId,
    onSessionExpired: refreshSession,
  });

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!storeDomain) return;
    fetch(`/api/stores/${storeDomain}/public`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => setStoreInfo(data))
      .catch(() => setStoreNotFound(true));
  }, [storeDomain]);

  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 150);
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [messages, isLoading]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading || !sessionId) return;
    const msg = input;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    sendMessage(msg);
  }, [input, isLoading, sessionId, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const storeName = formatStoreName(storeDomain);
  const isChatDisabled = chatDisabled || (storeInfo && !storeInfo.chatEnabled);

  if (storeNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Store Not Found</h1>
          <p className="text-gray-500">The store you're looking for doesn't exist or hasn't set up their shopping assistant yet.</p>
        </div>
      </div>
    );
  }

  if (isChatDisabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Chat Unavailable</h1>
          <p className="text-gray-500">The shopping assistant for {storeName} is currently unavailable. Please check back later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-white ${isEmbed ? "h-screen" : "min-h-screen"}`}>
      {!isEmbed && (
        <header className="border-b border-gray-100 bg-white sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <ShoppingBag className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">{storeName}</h1>
              <p className="text-xs text-gray-500">Personal Shopping Assistant</p>
            </div>
          </div>
        </header>
      )}

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-indigo-50 rounded-2xl mb-6">
                <Sparkles className="w-10 h-10 text-indigo-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Welcome to {storeName}'s personal shopping assistant
              </h2>
              <p className="text-gray-500 max-w-md">
                I can help you find products, answer questions about sizing, check availability, and more. What are you looking for today?
              </p>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg._id}>
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {msg.toolCalls.map((tc: ToolCall) => (
                      <ToolBadge key={tc.id} name={tc.name} />
                    ))}
                  </div>
                )}
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    ) : (
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5">
                        <MarkdownContent content={msg.content || "\u00A0"} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <ChatLoadingIndicator variant="dots" />
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      <div className="border-t border-gray-100 bg-white sticky bottom-0">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 p-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about our products..."
              rows={1}
              className="flex-1 resize-none bg-transparent border-none outline-none text-sm text-gray-900 placeholder:text-gray-400 min-h-[36px] py-2 px-2"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || !sessionId}
              className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          {!isEmbed && (
            <p className="text-center text-xs text-gray-400 mt-2">Powered by AI Shopping Assistant</p>
          )}
        </div>
      </div>
    </div>
  );
}
