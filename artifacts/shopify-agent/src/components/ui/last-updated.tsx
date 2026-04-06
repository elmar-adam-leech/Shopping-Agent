import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function LastUpdated({ dataUpdatedAt }: { dataUpdatedAt: number }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  if (!dataUpdatedAt) return null;

  const updatedDate = new Date(dataUpdatedAt);
  const isRecent = Date.now() - dataUpdatedAt < 10000;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <RefreshCw
        className={`w-3 h-3 ${isRecent ? "animate-spin text-primary" : ""}`}
      />
      <span>Updated {formatTimeAgo(updatedDate)}</span>
    </span>
  );
}
