import type { ReactNode } from "react";

interface EntityCardProps {
  imageUrl?: string;
  imageAlt?: string;
  children: ReactNode;
}

export function EntityCard({ imageUrl, imageAlt, children }: EntityCardProps) {
  return (
    <div className="flex gap-3 p-3 bg-card border border-border/50 rounded-xl hover:border-primary/30 transition-colors">
      {imageUrl && (
        <img src={imageUrl} alt={imageAlt || ""} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
