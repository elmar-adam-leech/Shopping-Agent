import { useState, useRef, useEffect } from "react";
import { useRoute } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { CartPanel } from "@/components/chat/cart-panel";
import { useSession } from "@/hooks/use-session";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useListConversations } from "@workspace/api-client-react";
import { Send, Sparkles, Loader2, RefreshCw, ShoppingBag } from "lucide-react";
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

export default function ChatPage() {
  const [, params] = useRoute("/:storeDomain/chat");
  const storeDomain = params?.storeDomain || "";
  const sessionId = useSession(storeDomain);
  
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, sendMessage } = useChatStream({
    storeDomain,
    sessionId: sessionId || "",
    conversationId: null // For MVP, we'll just use null for a single continuous session, real app would handle specific conversations
  });

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
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col h-full bg-background/50 relative z-10">
          
          {/* Header */}
          <div className="h-16 border-b border-border/50 flex items-center px-6 bg-background/80 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-sm">Shopping Assistant</h2>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-32">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-700">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white mb-6 shadow-xl shadow-primary/20">
                  <Sparkles className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-display font-bold mb-2 text-foreground">How can I help you today?</h3>
                <p className="text-muted-foreground max-w-sm mb-8">
                  I'm an AI assistant trained on {storeDomain}'s products and policies. Ask me anything!
                </p>
                <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                  {["Recommend a 9K BTU Mini Split", "What are your return policies?", "Find matching accessories"].map(preset => (
                    <button 
                      key={preset}
                      onClick={() => { setInput(preset); setTimeout(handleSubmit, 100); }}
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
                  <MessageBubble key={i} message={msg} />
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

function MessageBubble({ message }: { message: any }) {
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

        {/* Render tool calls nicely if they exist */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-col gap-2 w-full mt-2">
            {message.toolCalls.map((tc: any, idx: number) => {
              // Only render specific tools visually
              if (tc.name === 'add_to_cart') {
                return (
                  <div key={idx} className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-center gap-3 text-sm text-emerald-800 dark:text-emerald-300">
                    <div className="bg-emerald-100 dark:bg-emerald-800/50 p-2 rounded-lg">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    Added an item to your cart!
                  </div>
                );
              }
              if (tc.name === 'search_products') {
                return (
                  <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground font-medium bg-secondary/30 px-3 py-1.5 rounded-full w-fit border border-border/50">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Searching Shopify catalog...
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
