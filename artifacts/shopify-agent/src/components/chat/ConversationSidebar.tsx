import { memo, useState } from "react";
import { Plus, Trash2, MessageSquare, RotateCcw, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@workspace/api-client-react";

interface ConversationItem {
  id: number;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
}

interface ConversationSidebarProps {
  conversations: ConversationItem[] | undefined;
  activeConversationId: number | null;
  onNewConversation: () => void;
  onSelectConversation: (conv: ConversationItem) => void;
  onDeleteConversation: (convId: number) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  deletedConversations?: ConversationItem[];
  onRestoreConversation?: (convId: number) => void;
}

export const ConversationSidebar = memo(function ConversationSidebar({
  conversations,
  activeConversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  hasMore,
  onLoadMore,
  deletedConversations,
  onRestoreConversation,
}: ConversationSidebarProps) {
  const [showDeleted, setShowDeleted] = useState(false);
  return (
    <nav aria-label="Conversation history" className="w-64 border-r border-border/50 bg-card/50 flex flex-col h-full hidden md:flex">
      <div className="p-4 border-b border-border/50">
        <Button onClick={onNewConversation} className="w-full rounded-xl" variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" aria-hidden="true" /> New Chat
        </Button>
      </div>
      <ul className="flex-1 overflow-y-auto p-2 space-y-1" aria-label="Conversations">
        {conversations && conversations.map((conv) => (
          <li
            key={conv.id}
            className={cn(
              "group flex items-center gap-2 rounded-xl transition-colors text-sm",
              activeConversationId === conv.id
                ? "bg-primary/10 text-primary border border-primary/20"
                : "hover:bg-secondary/50 text-muted-foreground"
            )}
          >
            <button
              onClick={() => onSelectConversation(conv)}
              className="flex items-center gap-2 flex-1 min-w-0 p-3 rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-ring"
              aria-current={activeConversationId === conv.id ? "true" : undefined}
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span className="truncate flex-1">{conv.title}</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive focus:text-destructive transition-all focus:outline-none focus:ring-2 focus:ring-ring rounded mr-1 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={`Delete conversation: ${conv.title}`}
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
        {(!conversations || conversations.length === 0) && (
          <li className="text-center py-8 text-muted-foreground text-xs list-none">
            No conversations yet
          </li>
        )}
        {hasMore && onLoadMore && (
          <li className="list-none">
            <button
              onClick={onLoadMore}
              className="w-full py-3 min-h-11 text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring rounded"
            >
              Load more...
            </button>
          </li>
        )}
        {deletedConversations && deletedConversations.length > 0 && (
          <li className="list-none pt-2 border-t border-border/50 mt-2">
            <button
              onClick={() => setShowDeleted(!showDeleted)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg"
            >
              <Archive className="w-3 h-3" />
              Recently Deleted ({deletedConversations.length})
            </button>
            {showDeleted && (
              <ul className="space-y-1 mt-1">
                {deletedConversations.map((conv) => (
                  <li
                    key={conv.id}
                    className="flex items-center gap-2 rounded-xl text-sm text-muted-foreground/60 px-3 py-2"
                  >
                    <MessageSquare className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate flex-1 line-through">{conv.title}</span>
                    {onRestoreConversation && (
                      <button
                        onClick={() => onRestoreConversation(conv.id)}
                        className="text-primary hover:text-primary/80 transition-colors focus:outline-none focus:ring-2 focus:ring-ring rounded"
                        aria-label={`Restore conversation: ${conv.title}`}
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        )}
      </ul>
    </nav>
  );
});
