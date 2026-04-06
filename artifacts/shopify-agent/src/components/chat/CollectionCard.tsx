import { useChatActions } from "@/contexts/chat-actions-context";

export interface CollectionCardData {
  title?: string;
  handle?: string;
  description?: string;
  image?: { url?: string; altText?: string };
  productsCount?: number;
}

export function CollectionCard({ collection }: { collection: CollectionCardData }) {
  const actions = useChatActions();

  const handleClick = () => {
    if (actions && collection.title) {
      actions.sendMessage(`Show me products from ${collection.title}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex gap-3 p-3 bg-card border border-border/50 rounded-xl hover:border-primary/30 transition-colors w-full text-left group min-h-[44px] cursor-pointer"
      aria-label={`Browse products from ${collection.title || "collection"}`}
    >
      {collection.image?.url && (
        <img
          src={collection.image.url}
          alt={collection.title || "Collection"}
          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
          {collection.title}
        </h4>
        {collection.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {collection.description}
          </p>
        )}
        <p className="text-xs text-primary/70 mt-1 group-hover:text-primary transition-colors">
          Tap to browse →
        </p>
      </div>
    </button>
  );
}
