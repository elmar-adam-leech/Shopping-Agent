import { useState, useRef, useEffect } from "react";
import { useRoute } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { CartPanel } from "@/components/chat/cart-panel";
import { useSession } from "@/hooks/use-session";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useListConversations, useGetPreferences, useUpdatePreferences } from "@workspace/api-client-react";
import { Send, Sparkles, Loader2, RefreshCw, ShoppingBag, MessageSquare, Plus, Trash2, Search, Tag, Package, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ToolCallDisplay {
  id: string;
  name: string;
  arguments: string;
}

interface ChatMessageDisplay {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolCalls?: ToolCallDisplay[];
  toolResults?: Array<{ toolCallId: string; content: string }>;
}

export default function ChatPage() {
  const [, params] = useRoute("/:storeDomain/chat");
  const storeDomain = params?.storeDomain || "";
  const sessionId = useSession(storeDomain);
  
  const [input, setInput] = useState("");
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversationsResult = useListConversations(
    storeDomain,
    { sessionId: sessionId || "" }
  );
  const conversations = sessionId ? conversationsResult.data : undefined;
  const refetchConversations = conversationsResult.refetch;

  const { messages, isLoading, sendMessage, loadMessages } = useChatStream({
    storeDomain,
    sessionId: sessionId || "",
    conversationId: activeConversationId,
    onSuccess: () => refetchConversations()
  });

  const [showPrefs, setShowPrefs] = useState(false);

  const { data: prefsData } = useGetPreferences(
    storeDomain,
    { sessionId: sessionId || "" }
  );
  const { mutateAsync: updatePrefs } = useUpdatePreferences();

  const userPrefs = (prefsData?.prefs || {}) as Record<string, string>;

  const handlePrefChange = async (key: string, value: string) => {
    if (!sessionId) return;
    const updated = { ...userPrefs, [key]: value };
    await updatePrefs({
      storeDomain,
      data: { sessionId, prefs: updated }
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const startNewConversation = () => {
    setActiveConversationId(null);
    loadMessages([]);
  };

  const selectConversation = (conv: { id: number; messages: ChatMessageDisplay[] }) => {
    setActiveConversationId(conv.id);
    loadMessages(conv.messages || []);
  };

  const handleDeleteConversation = async (convId: number) => {
    try {
      await fetch(`/api/stores/${storeDomain}/conversations/${convId}`, {
        method: 'DELETE',
        headers: { 'x-session-id': sessionId || '' },
      });
      if (activeConversationId === convId) {
        startNewConversation();
      }
      refetchConversations();
    } catch {
      console.error("Failed to delete conversation");
    }
  };

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
        {/* Conversation Sidebar */}
        <div className="w-64 border-r border-border/50 bg-card/50 flex flex-col h-full hidden md:flex">
          <div className="p-4 border-b border-border/50">
            <Button onClick={startNewConversation} className="w-full rounded-xl" variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" /> New Chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations && (conversations as Array<{ id: number; title: string; messages: ChatMessageDisplay[]; updatedAt: string }>).map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-colors text-sm",
                  activeConversationId === conv.id
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "hover:bg-secondary/50 text-muted-foreground"
                )}
                onClick={() => selectConversation(conv)}
              >
                <MessageSquare className="w-4 h-4 flex-shrink-0" />
                <span className="truncate flex-1">{conv.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {(!conversations || (conversations as Array<unknown>).length === 0) && (
              <div className="text-center py-8 text-muted-foreground text-xs">
                No conversations yet
              </div>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col h-full bg-background/50 relative z-10">
          
          {/* Header */}
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

          {showPrefs && (
            <div className="border-b border-border/50 bg-card/80 backdrop-blur-sm px-6 py-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" /> Your Preferences
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Display Name</label>
                  <input
                    className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Your name"
                    defaultValue={userPrefs.displayName || ''}
                    onBlur={(e) => handlePrefChange('displayName', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Preferred Units</label>
                  <select
                    className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    defaultValue={userPrefs.units || 'imperial'}
                    onChange={(e) => handlePrefChange('units', e.target.value)}
                  >
                    <option value="imperial">Imperial (ft, lbs)</option>
                    <option value="metric">Metric (m, kg)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Budget Range</label>
                  <select
                    className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    defaultValue={userPrefs.budget || ''}
                    onChange={(e) => handlePrefChange('budget', e.target.value)}
                  >
                    <option value="">No preference</option>
                    <option value="budget">Budget-friendly</option>
                    <option value="mid">Mid-range</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Communication Style</label>
                  <select
                    className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    defaultValue={userPrefs.style || 'friendly'}
                    onChange={(e) => handlePrefChange('style', e.target.value)}
                  >
                    <option value="friendly">Friendly & Casual</option>
                    <option value="professional">Professional</option>
                    <option value="concise">Brief & Concise</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-32">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-700">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white mb-6 shadow-xl shadow-primary/20">
                  <Sparkles className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-display font-bold mb-2 text-foreground">How can I help you today?</h3>
                <p className="text-muted-foreground max-w-sm mb-8">
                  I'm an AI assistant for {storeDomain}. Ask me anything about products, sizing, or policies!
                </p>
                <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                  {["Recommend a 9K BTU Mini Split", "What are your return policies?", "Find matching accessories"].map(preset => (
                    <button 
                      key={preset}
                      onClick={() => { setInput(preset); }}
                      className="px-4 py-2 rounded-full bg-secondary/50 border border-border/50 text-sm hover:bg-secondary hover:text-foreground text-muted-foreground transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
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
                      Agent is thinking...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-10">
            <div className="max-w-4xl mx-auto relative">
              <form 
                onSubmit={handleSubmit}
                className="relative flex items-end bg-card border border-border shadow-xl shadow-black/5 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all"
              >
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about products, sizing, or policies..."
                  className="min-h-[60px] max-h-[200px] w-full resize-none border-0 focus-visible:ring-0 bg-transparent py-4 pl-4 pr-14"
                  rows={1}
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 bottom-2 rounded-xl bg-primary text-white hover:bg-primary/90"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
              <div className="text-center mt-2">
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  Powered by Shopify MCP Agent
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Cart */}
        <CartPanel />
      </div>
    </AppLayout>
  );
}

interface ProductCardData {
  title?: string;
  handle?: string;
  id?: string;
  featuredImage?: { url?: string; altText?: string };
  images?: { edges?: Array<{ node: { url?: string; altText?: string } }> };
  priceRange?: {
    minVariantPrice?: { amount?: string; currencyCode?: string };
    maxVariantPrice?: { amount?: string; currencyCode?: string };
  };
  description?: string;
  vendor?: string;
}

interface CollectionCardData {
  title?: string;
  handle?: string;
  description?: string;
  image?: { url?: string; altText?: string };
  productsCount?: number;
}

function tryParseToolResult(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function ProductCard({ product }: { product: ProductCardData }) {
  const imageUrl = product.featuredImage?.url || product.images?.edges?.[0]?.node?.url;
  const price = product.priceRange?.minVariantPrice;
  return (
    <div className="flex gap-3 p-3 bg-card border border-border/50 rounded-xl hover:border-primary/30 transition-colors">
      {imageUrl && (
        <img src={imageUrl} alt={product.title || "Product"} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm truncate">{product.title}</h4>
        {product.vendor && <p className="text-xs text-muted-foreground">{product.vendor}</p>}
        {price && (
          <p className="text-sm font-bold text-primary mt-1">
            {price.currencyCode === 'USD' ? '$' : price.currencyCode}{price.amount}
          </p>
        )}
      </div>
    </div>
  );
}

function CollectionCard({ collection }: { collection: CollectionCardData }) {
  return (
    <div className="flex gap-3 p-3 bg-card border border-border/50 rounded-xl hover:border-primary/30 transition-colors">
      {collection.image?.url && (
        <img src={collection.image.url} alt={collection.title || "Collection"} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm truncate">{collection.title}</h4>
        {collection.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{collection.description}</p>
        )}
      </div>
    </div>
  );
}

function ToolResultCards({ toolName, content }: { toolName: string; content: string }) {
  const parsed = tryParseToolResult(content);
  if (!parsed || typeof parsed !== 'object') return null;

  const data = parsed as Record<string, unknown>;

  if (toolName === 'search_products' || toolName === 'get_product') {
    const products: ProductCardData[] = [];
    if (data.products && Array.isArray((data.products as Record<string, unknown>).edges)) {
      for (const edge of (data.products as { edges: Array<{ node: ProductCardData }> }).edges) {
        products.push(edge.node);
      }
    } else if (data.product && typeof data.product === 'object') {
      products.push(data.product as ProductCardData);
    } else if (Array.isArray(data)) {
      products.push(...(data as ProductCardData[]));
    }

    if (products.length === 0) return null;

    return (
      <div className="grid gap-2 mt-2">
        {products.slice(0, 6).map((p, i) => (
          <ProductCard key={i} product={p} />
        ))}
      </div>
    );
  }

  if (toolName === 'get_collections') {
    const collections: CollectionCardData[] = [];
    if (data.collections && Array.isArray((data.collections as Record<string, unknown>).edges)) {
      for (const edge of (data.collections as { edges: Array<{ node: CollectionCardData }> }).edges) {
        collections.push(edge.node);
      }
    }

    if (collections.length === 0) return null;

    return (
      <div className="grid gap-2 mt-2">
        {collections.slice(0, 6).map((c, i) => (
          <CollectionCard key={i} collection={c} />
        ))}
      </div>
    );
  }

  return null;
}

function ToolCallBadge({ tc }: { tc: ToolCallDisplay }) {
  const iconMap: Record<string, React.ReactNode> = {
    search_products: <Search className="w-3.5 h-3.5" />,
    get_product: <Package className="w-3.5 h-3.5" />,
    get_collections: <Tag className="w-3.5 h-3.5" />,
    add_to_cart: <ShoppingBag className="w-3.5 h-3.5" />,
    create_cart: <ShoppingBag className="w-3.5 h-3.5" />,
    get_cart: <ShoppingBag className="w-3.5 h-3.5" />,
  };
  const labelMap: Record<string, string> = {
    search_products: "Searching products...",
    get_product: "Getting product details...",
    get_collections: "Fetching collections...",
    add_to_cart: "Added to cart!",
    create_cart: "Creating cart...",
    get_cart: "Loading cart...",
    get_blogs: "Fetching articles...",
  };

  if (tc.name === 'add_to_cart') {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-center gap-3 text-sm text-emerald-800 dark:text-emerald-300">
        <div className="bg-emerald-100 dark:bg-emerald-800/50 p-2 rounded-lg">
          <ShoppingBag className="w-4 h-4" />
        </div>
        Added an item to your cart!
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium bg-secondary/30 px-3 py-1.5 rounded-full w-fit border border-border/50">
      {iconMap[tc.name] || <RefreshCw className="w-3 h-3" />}
      {labelMap[tc.name] || `Using ${tc.name}...`}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessageDisplay }) {
  const isUser = message.role === 'user';
  
  return (
    <div className={cn(
      "flex gap-4 w-full animate-in slide-in-from-bottom-2 duration-300",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      <Avatar className={cn(
        "w-10 h-10 border shadow-sm flex-shrink-0 flex items-center justify-center text-sm font-bold",
        isUser ? "bg-slate-900 text-white border-slate-800" : "bg-gradient-to-br from-primary to-accent text-white border-primary/20"
      )}>
        {isUser ? "U" : <Sparkles className="w-5 h-5" />}
      </Avatar>
      
      <div className={cn(
        "flex flex-col gap-2 max-w-[85%] md:max-w-[75%]",
        isUser ? "items-end" : "items-start"
      )}>
        {message.content && (
          <div className={cn(
            "px-5 py-3.5 rounded-2xl shadow-sm text-[15px] leading-relaxed",
            isUser 
              ? "bg-slate-900 text-white rounded-tr-sm dark:bg-slate-100 dark:text-slate-900" 
              : "bg-card border border-border/50 text-foreground rounded-tl-sm"
          )}>
            <div className="prose prose-sm dark:prose-invert max-w-none break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-col gap-2 w-full mt-1">
            {message.toolCalls.map((tc, idx) => (
              <ToolCallBadge key={idx} tc={tc} />
            ))}
          </div>
        )}

        {message.toolResults && message.toolResults.length > 0 && message.toolCalls && (
          <div className="w-full">
            {message.toolResults.map((tr, idx) => {
              const matchingCall = message.toolCalls?.find(tc => tc.id === tr.toolCallId);
              if (!matchingCall) return null;
              return <ToolResultCards key={idx} toolName={matchingCall.name} content={tr.content} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
