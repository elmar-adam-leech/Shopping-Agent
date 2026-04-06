import { useState, useCallback } from "react";
import { ShoppingCart, Check, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useChatActions } from "@/contexts/chat-actions-context";

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
  productType?: string;
  tags?: string[];
  availableForSale?: boolean;
  variants?: {
    edges?: Array<{
      node: {
        id?: string;
        title?: string;
        price?: { amount?: string; currencyCode?: string };
        availableForSale?: boolean;
      };
    }>;
  };
  options?: Array<{
    name?: string;
    values?: string[];
  }>;
}

type AddState = "idle" | "loading" | "success" | "error";

function ImageGallery({ images }: { images: Array<{ url?: string; altText?: string }> }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const validImages = images.filter((img) => img.url);

  if (validImages.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-secondary/30">
        <img
          src={validImages[activeIndex]?.url}
          alt={validImages[activeIndex]?.altText || "Product image"}
          className="w-full h-full object-cover"
        />
        {validImages.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((i) => (i === 0 ? validImages.length - 1 : i - 1));
              }}
              className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-background/80 border border-border/50 shadow-sm hover:bg-background min-w-[44px] min-h-[44px]"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((i) => (i === validImages.length - 1 ? 0 : i + 1));
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-background/80 border border-border/50 shadow-sm hover:bg-background min-w-[44px] min-h-[44px]"
              aria-label="Next image"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
      {validImages.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {validImages.map((img, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex(i);
              }}
              className={`flex-shrink-0 w-10 h-10 rounded-md overflow-hidden border-2 transition-colors min-w-[44px] min-h-[44px] ${
                i === activeIndex
                  ? "border-primary"
                  : "border-transparent hover:border-border"
              }`}
              aria-label={`View image ${i + 1}`}
            >
              <img
                src={img.url}
                alt={img.altText || `Thumbnail ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickAddButton({ product }: { product: ProductCardData }) {
  const [addState, setAddState] = useState<AddState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const actions = useChatActions();

  const variant = product.variants?.edges?.[0]?.node;
  const variantId = variant?.id || product.id;
  const canAdd = !!variantId && !!actions;

  const handleAdd = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (addState !== "idle" || !actions || !variantId) return;

      setAddState("loading");
      setErrorMsg(null);

      try {
        const price = variant?.price?.amount || product.priceRange?.minVariantPrice?.amount || "0";
        const imageUrl = product.featuredImage?.url || product.images?.edges?.[0]?.node?.url;

        await actions.quickAddToCart({
          variantId,
          title: product.title || "Product",
          price: parseFloat(price),
          imageUrl,
        });
        setAddState("success");
        setTimeout(() => setAddState("idle"), 3000);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to add";
        setErrorMsg(msg);
        setAddState("error");
        setTimeout(() => {
          setAddState("idle");
          setErrorMsg(null);
        }, 3000);
      }
    },
    [product, addState, actions, variantId, variant],
  );

  return (
    <button
      onClick={handleAdd}
      disabled={!canAdd || addState === "loading"}
      title={errorMsg || undefined}
      className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[44px] min-w-[44px] ${
        addState === "success"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : addState === "error"
            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            : addState === "loading"
              ? "bg-primary/5 text-primary/60 cursor-wait"
              : "bg-primary/10 text-primary hover:bg-primary/20 active:scale-95"
      }`}
      aria-label={
        addState === "success"
          ? "Added to cart"
          : addState === "error"
            ? errorMsg || "Error adding to cart"
            : `Add ${product.title || "product"} to cart`
      }
    >
      {addState === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {addState === "success" && <Check className="w-3.5 h-3.5" />}
      {(addState === "idle" || addState === "error") && <ShoppingCart className="w-3.5 h-3.5" />}
      {addState === "success" ? "Added" : addState === "loading" ? "Adding..." : addState === "error" ? "Failed" : "Add to Cart"}
    </button>
  );
}

interface ProductCardProps {
  product: ProductCardData;
  variant?: "default" | "carousel";
}

export function ProductCard({ product, variant = "default" }: ProductCardProps) {
  const [expanded, setExpanded] = useState(false);
  const imageUrl = product.featuredImage?.url || product.images?.edges?.[0]?.node?.url;
  const price = product.priceRange?.minVariantPrice;

  const allImages: Array<{ url?: string; altText?: string }> = [];
  if (product.images?.edges) {
    for (const edge of product.images.edges) {
      allImages.push(edge.node);
    }
  } else if (product.featuredImage?.url) {
    allImages.push(product.featuredImage);
  }

  const hasMultipleImages = allImages.filter((img) => img.url).length > 1;

  if (variant === "carousel") {
    return (
      <div className="flex flex-col bg-card border border-border/50 rounded-xl hover:border-primary/30 transition-colors h-full">
        {imageUrl && (
          <div className="w-full aspect-square rounded-t-xl overflow-hidden bg-secondary/30">
            <img
              src={imageUrl}
              alt={product.title || "Product"}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="p-3 flex flex-col flex-1">
          <h4 className="font-semibold text-sm truncate">{product.title}</h4>
          {product.vendor && (
            <p className="text-xs text-muted-foreground">{product.vendor}</p>
          )}
          {price && (
            <p className="text-sm font-bold text-primary mt-1">
              {price.currencyCode === "USD" ? "$" : price.currencyCode}
              {price.amount}
            </p>
          )}
          <div className="mt-auto pt-2">
            <QuickAddButton product={product} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-card border border-border/50 rounded-xl hover:border-primary/30 transition-colors ${
        hasMultipleImages ? "cursor-pointer" : ""
      }`}
      onClick={() => hasMultipleImages && setExpanded(!expanded)}
      role={hasMultipleImages ? "button" : undefined}
      tabIndex={hasMultipleImages ? 0 : undefined}
      onKeyDown={
        hasMultipleImages
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setExpanded(!expanded);
              }
            }
          : undefined
      }
      aria-expanded={hasMultipleImages ? expanded : undefined}
      aria-label={
        hasMultipleImages ? `${product.title} - click to ${expanded ? "collapse" : "expand"} images` : undefined
      }
    >
      <div className="flex gap-3 p-3">
        {imageUrl && !expanded && (
          <img
            src={imageUrl}
            alt={product.title || "Product"}
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm truncate">{product.title}</h4>
          {product.vendor && (
            <p className="text-xs text-muted-foreground">{product.vendor}</p>
          )}
          <div className="flex items-center justify-between mt-1 gap-2">
            {price && (
              <p className="text-sm font-bold text-primary">
                {price.currencyCode === "USD" ? "$" : price.currencyCode}
                {price.amount}
              </p>
            )}
            <QuickAddButton product={product} />
          </div>
        </div>
      </div>

      {expanded && hasMultipleImages && (
        <div className="px-3 pb-3">
          <ImageGallery images={allImages} />
        </div>
      )}
    </div>
  );
}
