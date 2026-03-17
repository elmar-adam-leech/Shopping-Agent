import { Plus, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatMessageDisplay } from "./MessageBubble";

interface ConversationItem {
  id: number;
  title: string;
  messages: ChatMessageDisplay[];
  updatedAt: string;
}

interface ConversationSidebarProps {
  conversations: ConversationItem[] | undefined;
  activeConversationId: number | null;
  onNewConversation: () => void;
  onSelectConversation: (conv: ConversationItem) => void;
  onDeleteConversation: (convId: number) => void;
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
}: ConversationSidebarProps) {
  return (
    <div className="w-64 border-r border-border/50 bg-card/50 flex flex-col h-full hidden md:flex">
      <div className="p-4 border-b border-border/50">
        <Button onClick={onNewConversation} className="w-full rounded-xl" variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" /> New Chat
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations && conversations.map((conv) => (
          <div
            key={conv.id}
            className={cn(
              "group flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-colors text-sm",
              activeConversationId === conv.id
                ? "bg-primary/10 text-primary border border-primary/20"
                : "hover:bg-secondary/50 text-muted-foreground"
            )}
            onClick={() => onSelectConversation(conv)}
          >
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            <span className="truncate flex-1">{conv.title}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        {(!conversations || conversations.length === 0) && (
          <div className="text-center py-8 text-muted-foreground text-xs">
            No conversations yet
          </div>
        )}
      </div>
    </div>
  );
}
