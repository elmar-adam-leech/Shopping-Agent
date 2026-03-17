export interface CollectionCardData {
  title?: string;
  handle?: string;
  description?: string;
  image?: { url?: string; altText?: string };
  productsCount?: number;
}

export function CollectionCard({ collection }: { collection: CollectionCardData }) {
  return (
    <div className="flex gap-3 p-3 bg-card border border-border/50 rounded-xl hover:border-primary/30 transition-colors">
      {collection.image?.url && (
        <img src={collection.image.url} alt={collection.title || "Collection"} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm truncate">{collection.title}</h4>
        {collection.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{collection.description}</p>
        )}
      </div>
    </div>
  );
}
