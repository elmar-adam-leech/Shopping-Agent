export interface ProductCardData {
  title?: string;
  handle?: string;
  id?: string;
  featuredImage?: { url?: string; altText?: string };
  images?: { edges?: Array<{ node: { url?: string; altText?: string } }> };
  priceRange?: {
    minVariantPrice?: { amount?: string; currencyCode?: string };
    maxVariantPrice?: { amount?: string; currencyCode?: string };
  };
  description?: string;
  vendor?: string;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const imageUrl = product.featuredImage?.url || product.images?.edges?.[0]?.node?.url;
  const price = product.priceRange?.minVariantPrice;
  return (
    <div className="flex gap-3 p-3 bg-card border border-border/50 rounded-xl hover:border-primary/30 transition-colors">
      {imageUrl && (
        <img src={imageUrl} alt={product.title || "Product"} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm truncate">{product.title}</h4>
        {product.vendor && <p className="text-xs text-muted-foreground">{product.vendor}</p>}
        {price && (
          <p className="text-sm font-bold text-primary mt-1">
            {price.currencyCode === 'USD' ? '$' : price.currencyCode}{price.amount}
          </p>
        )}
      </div>
    </div>
  );
}
