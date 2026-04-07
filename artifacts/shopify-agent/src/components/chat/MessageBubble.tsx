import { memo, useState, useCallback } from "react";
import { Sparkles, AlertTriangle, ThumbsUp, ThumbsDown, Send, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { cn } from "@/lib/utils";
import { ToolBadge, type ToolCallDisplay } from "@/components/ui/tool-badge";
import { ToolResultCards } from "./ToolResultCards";

export interface ChatMessageDisplay {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolCalls?: ToolCallDisplay[];
  toolResults?: Array<{ toolCallId: string; content: string }>;
  retracted?: boolean;
  serverMessageId?: string;
}

interface FeedbackProps {
  storeDomain: string;
  sessionId: string;
  conversationId?: number | null;
}

type FeedbackState = "none" | "positive" | "negative";

function FeedbackButtons({
  message,
  feedbackProps,
}: {
  message: ChatMessageDisplay;
  feedbackProps?: FeedbackProps;
}) {
  const [feedbackState, setFeedbackState] = useState<FeedbackState>("none");
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitFeedbackRequest = useCallback(
    async (rating: "positive" | "negative", feedbackComment?: string): Promise<boolean> => {
      if (!feedbackProps) return false;
      setSubmitting(true);
      try {
        const body: Record<string, unknown> = {
          messageId: message.serverMessageId || message.timestamp,
          rating,
          messageContent: message.content,
        };
        if (feedbackComment) body.comment = feedbackComment;
        if (feedbackProps.conversationId != null) body.conversationId = feedbackProps.conversationId;

        const res = await fetch(`/api/stores/${feedbackProps.storeDomain}/feedback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-session-id": feedbackProps.sessionId,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) return false;
        const data = await res.json();
        return data?.success === true;
      } catch (err) {
        console.warn("Failed to submit feedback:", err);
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [feedbackProps, message.serverMessageId, message.timestamp, message.content],
  );

  const handleThumbsUp = useCallback(async () => {
    if (feedbackState !== "none") return;
    setFeedbackState("positive");
    const ok = await submitFeedbackRequest("positive");
    if (!ok) setFeedbackState("none");
  }, [feedbackState, submitFeedbackRequest]);

  const handleThumbsDown = useCallback(async () => {
    if (feedbackState !== "none") return;
    setFeedbackState("negative");
    const ok = await submitFeedbackRequest("negative");
    if (!ok) {
      setFeedbackState("none");
      return;
    }
    setShowCommentInput(true);
  }, [feedbackState, submitFeedbackRequest]);

  const handleSubmitComment = useCallback(async () => {
    if (comment.trim()) {
      await submitFeedbackRequest("negative", comment.trim());
    }
    setShowCommentInput(false);
  }, [submitFeedbackRequest, comment]);

  const handleSkipComment = useCallback(() => {
    setShowCommentInput(false);
  }, []);

  if (feedbackState !== "none" && !showCommentInput) {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-xs text-muted-foreground">
          {feedbackState === "positive" ? "Thanks for your feedback!" : "Thanks, we'll work on it."}
        </span>
        <span className="text-xs">
          {feedbackState === "positive" ? (
            <ThumbsUp className="w-3 h-3 text-green-500 fill-green-500" />
          ) : (
            <ThumbsDown className="w-3 h-3 text-red-500 fill-red-500" />
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mt-1">
      {feedbackState === "none" && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={handleThumbsUp}
            disabled={submitting}
            className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-green-600 transition-colors disabled:opacity-50"
            title="Good response"
            aria-label="Rate this response as helpful"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleThumbsDown}
            disabled={submitting}
            className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
            title="Bad response"
            aria-label="Rate this response as unhelpful"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {showCommentInput && (
        <div className="flex items-center gap-2 animate-in slide-in-from-top-1 duration-200">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What went wrong? (optional)"
            className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmitComment();
            }}
            autoFocus
          />
          <button
            onClick={handleSubmitComment}
            disabled={submitting}
            className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            title="Submit feedback"
            aria-label="Submit negative feedback"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleSkipComment}
            disabled={submitting}
            className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground transition-colors disabled:opacity-50"
            title="Skip comment"
            aria-label="Skip comment and submit"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function MessageBubbleInner({
  message,
  feedbackProps,
}: {
  message: ChatMessageDisplay;
  feedbackProps?: FeedbackProps;
}) {
  const isUser = message.role === 'user';
  const isRetracted = !!message.retracted;
  const showFeedback = !isUser && !isRetracted && message.content && feedbackProps;
  
  return (
    <div className={cn(
      "group flex gap-4 w-full animate-in slide-in-from-bottom-2 duration-300",
      isUser ? "flex-row-reverse" : "flex-row"
    )} role="article" aria-label={isUser ? "Your message" : isRetracted ? "Corrected message" : "Assistant message"}>
      <Avatar className={cn(
        "w-10 h-10 border shadow-sm flex-shrink-0 flex items-center justify-center text-sm font-bold",
        isUser ? "bg-slate-900 text-white border-slate-800"
          : isRetracted ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700"
          : "bg-gradient-to-br from-primary to-accent text-white border-primary/20"
      )} aria-hidden="true">
        {isUser ? "U" : isRetracted ? <AlertTriangle className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </Avatar>
      
      <div className={cn(
        "flex flex-col gap-2 max-w-[85%] md:max-w-[75%]",
        isUser ? "items-end" : "items-start"
      )}>
        {message.content && (
          <div className={cn(
            "px-5 py-3.5 rounded-2xl shadow-sm text-[15px] leading-relaxed",
            isRetracted
              ? "bg-amber-50 border border-amber-200 text-amber-800 rounded-tl-sm dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300"
              : isUser 
                ? "bg-slate-900 text-white rounded-tr-sm dark:bg-slate-100 dark:text-slate-900" 
                : "bg-card border border-border/50 text-foreground rounded-tl-sm"
          )}>
            <div className="prose prose-sm dark:prose-invert max-w-none break-words">
              {isRetracted ? (
                <p className="flex items-center gap-2 m-0">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {message.content}
                </p>
              ) : (
                <MarkdownContent content={message.content} />
              )}
            </div>
          </div>
        )}

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-col gap-2 w-full mt-1">
            {message.toolCalls.map((tc, idx) => (
              <ToolBadge key={idx} name={tc.name} variant="detailed" />
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

        {showFeedback && (
          <FeedbackButtons message={message} feedbackProps={feedbackProps} />
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
    prev.retracted !== next.retracted ||
    prev.toolCalls?.length !== next.toolCalls?.length ||
    prev.toolResults?.length !== next.toolResults?.length
  ) {
    return false;
  }
  if (prevProps.feedbackProps?.storeDomain !== nextProps.feedbackProps?.storeDomain ||
      prevProps.feedbackProps?.sessionId !== nextProps.feedbackProps?.sessionId ||
      prevProps.feedbackProps?.conversationId !== nextProps.feedbackProps?.conversationId) {
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
