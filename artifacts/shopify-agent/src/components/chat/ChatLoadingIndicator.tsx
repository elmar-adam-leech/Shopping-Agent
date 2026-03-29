import { Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

interface ChatLoadingIndicatorProps {
  variant?: "avatar" | "dots";
}

export function ChatLoadingIndicator({ variant = "avatar" }: ChatLoadingIndicatorProps) {
  if (variant === "dots") {
    return (
      <div className="flex justify-start" role="status" aria-label="Loading response">
        <div className="bg-gray-100 rounded-2xl px-4 py-3">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} aria-hidden="true" />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} aria-hidden="true" />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} aria-hidden="true" />
          </div>
          <span className="sr-only">Loading response</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 max-w-[85%]" role="status" aria-label="Agent is thinking">
      <Avatar className="w-10 h-10 border border-primary/20 bg-primary/5 flex items-center justify-center text-primary">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
      </Avatar>
      <div className="flex items-center text-sm text-muted-foreground bg-secondary/30 px-4 py-3 rounded-2xl rounded-tl-sm">
        Agent is thinking...
      </div>
    </div>
  );
}
