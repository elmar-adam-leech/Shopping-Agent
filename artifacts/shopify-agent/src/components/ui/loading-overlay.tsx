import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LoadingOverlayProps {
  loadingText?: string;
  error?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  retryVariant?: "button" | "link";
  className?: string;
}

export function LoadingOverlay({
  loadingText = "Loading...",
  error,
  onRetry,
  retryLabel = "Try Again",
  retryVariant = "button",
  className = "",
}: LoadingOverlayProps) {
  if (error) {
    return (
      <div className={`flex h-full items-center justify-center ${className}`} role="status" aria-label="Error">
        <div className="text-center space-y-3 p-4">
          <p className="text-muted-foreground text-sm">{error}</p>
          {onRetry && (
            retryVariant === "link" ? (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {retryLabel}
              </button>
            ) : (
              <Button variant="outline" onClick={onRetry}>
                {retryLabel}
              </Button>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-full items-center justify-center ${className}`} role="status" aria-label="Loading">
      <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">{loadingText}</span>
    </div>
  );
}
