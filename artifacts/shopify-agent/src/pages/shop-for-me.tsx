import { useState, useRef, useEffect, useCallback } from "react";
import { useRoute, useSearch } from "wouter";
import { Send, Sparkles, Loader2, ShoppingBag, Package, Tag, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage, ToolCall, ToolResult } from "@workspace/api-client-react";

const TOOL_LABELS: Record<string, string> = {
  search_products: "Searching products",
  get_product: "Looking up product",
  get_collections: "Browsing collections",
  list_collections: "Browsing collections",
  get_blogs: "Reading blog posts",
  list_blogs: "Reading blog posts",
  add_to_cart: "Adding to cart",
  get_cart: "Checking cart",
  get_product_recommendations: "Finding recommendations",
};

const TOOL_ICONS: Record<string, typeof Search> = {
  search_products: Search,
  get_product: Package,
  get_collections: Tag,
  get_product_recommendations: Sparkles,
};

interface StorePublicInfo {
  storeDomain: string;
  chatEnabled: boolean;
}

const SESSION_TTL_MS = 23 * 60 * 60 * 1000;

function useShopForMeSession(storeDomain: string) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatDisabled, setChatDisabled] = useState(false);

  const createNewSession = useCallback((key: string) => {
    return fetch(`/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeDomain }),
    })
      .then((res) => {
        if (res.status === 403) {
          setChatDisabled(true);
          throw new Error("Chat disabled");
        }
        if (!res.ok) throw new Error("Session creation failed");
        return res.json();
      })
      .then((data) => {
        const sessionData = {
          sessionId: data.sessionId,
          expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        };
        localStorage.setItem(key, JSON.stringify(sessionData));
        setSessionId(data.sessionId);
        return data.sessionId;
      })
      .catch((err) => {
        if (err.message !== "Chat disabled") {
          console.error("Failed to create session", err);
        }
        return null;
      });
  }, [storeDomain]);

  const refreshSession = useCallback(() => {
    const key = `shop_for_me_session_${storeDomain}`;
    localStorage.removeItem(key);
    return createNewSession(key);
  }, [storeDomain, createNewSession]);

  useEffect(() => {
    if (!storeDomain) return;
    const key = `shop_for_me_session_${storeDomain}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.sessionId && parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
          setSessionId(parsed.sessionId);
          return;
        }
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
    createNewSession(key);
  }, [storeDomain, createNewSession]);

  return { sessionId, chatDisabled, refreshSession };
}

function useShopForMeChatStream(storeDomain: string, sessionId: string | null, onSessionExpired?: () => Promise<string | null>) {
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

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;
        let assistantContent = "";
        let toolCalls: ToolCall[] = [];
        let toolResults: ToolResult[] = [];
        let sseBuffer = "";

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "", timestamp: new Date().toISOString() },
        ]);

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split("\n");
            sseBuffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const dataStr = line.substring(6).trim();
              if (dataStr === "[DONE]") continue;

              try {
                const event = JSON.parse(dataStr);
                if (event.type === "text") {
                  assistantContent += event.data;
                } else if (event.type === "conversation_id") {
                  setConversationId(event.data);
                } else if (event.type === "tool_call") {
                  toolCalls = [...toolCalls, { id: event.data.id, name: event.data.name, arguments: event.data.arguments }];
                } else if (event.type === "tool_result") {
                  toolResults = [...toolResults, { toolCallId: event.data.toolCallId, content: event.data.content }];
                }

                setMessages((prev) => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1] = {
                    ...newMsgs[newMsgs.length - 1],
                    content: assistantContent,
                    toolCalls: toolCalls.length > 0 ? [...toolCalls] : undefined,
                    toolResults: toolResults.length > 0 ? [...toolResults] : undefined,
                  };
                  return newMsgs;
                });
              } catch {
                /* incomplete JSON */
              }
            }
          }
        }
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

function formatStoreName(domain: string): string {
  return domain.replace(/\.myshopify\.com$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ToolBadge({ name }: { name: string }) {
  const label = TOOL_LABELS[name] || name;
  const Icon = TOOL_ICONS[name] || Sparkles;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

export default function ShopForMePage() {
  const [, params] = useRoute("/shop/:storeDomain");
  const storeDomain = params?.storeDomain || "";
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const isEmbed = searchParams.get("embed") === "true";

  const [storeInfo, setStoreInfo] = useState<StorePublicInfo | null>(null);
  const [storeNotFound, setStoreNotFound] = useState(false);
  const { sessionId, chatDisabled, refreshSession } = useShopForMeSession(storeDomain);
  const { messages, isLoading, sendMessage } = useShopForMeChatStream(storeDomain, sessionId, refreshSession);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    const msg = input;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    sendMessage(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {msg.toolCalls.map((tc) => (
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
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content || "\u00A0"}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
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
              disabled={!input.trim() || isLoading}
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
