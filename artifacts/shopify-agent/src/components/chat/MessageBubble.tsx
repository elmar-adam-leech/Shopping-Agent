import { memo } from "react";
import { Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { cn } from "@/lib/utils";
import { ToolCallBadge, type ToolCallDisplay } from "./ToolCallBadge";
import { ToolResultCards } from "./ToolResultCards";

export interface ChatMessageDisplay {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolCalls?: ToolCallDisplay[];
  toolResults?: Array<{ toolCallId: string; content: string }>;
}

function MessageBubbleInner({ message }: { message: ChatMessageDisplay }) {
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
              <MarkdownContent content={message.content} />
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

export const MessageBubble = memo(MessageBubbleInner, (prevProps, nextProps) => {
  const prev = prevProps.message;
  const next = nextProps.message;
  if (
    prev.role !== next.role ||
    prev.content !== next.content ||
    prev.timestamp !== next.timestamp ||
    prev.toolCalls?.length !== next.toolCalls?.length ||
    prev.toolResults?.length !== next.toolResults?.length
  ) {
    return false;
  }
  if (prev.toolCalls && next.toolCalls) {
    for (let i = 0; i < prev.toolCalls.length; i++) {
      const p = prev.toolCalls[i];
      const n = next.toolCalls[i];
      if (p.id !== n.id || p.name !== n.name || p.arguments !== n.arguments) return false;
    }
  }
  if (prev.toolResults && next.toolResults) {
    for (let i = 0; i < prev.toolResults.length; i++) {
      if (
        prev.toolResults[i].toolCallId !== next.toolResults[i].toolCallId ||
        prev.toolResults[i].content !== next.toolResults[i].content
      ) return false;
    }
  }
  return true;
});
