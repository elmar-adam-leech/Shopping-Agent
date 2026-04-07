import { Heart, Trash2, ShoppingCart, Loader2 } from "lucide-react";
import { useState, useCallback } from "react";
import { useChatActions } from "@/contexts/chat-actions-context";

export interface WishlistItemData {
  productId: string;
  variantId?: string;
  title: string;
  handle?: string;
  imageUrl?: string;
  price?: string;
  currencyCode?: string;
  addedAt: string;
}

function formatPrice(amount?: string, currency?: string): string | null {
  if (!amount) return null;
  const symbol = currency === "USD" ? "$" : currency ? `${currency} ` : "$";
  return `${symbol}${amount}`;
}

function WishlistItemRow({ item }: { item: WishlistItemData }) {
  const [addState, setAddState] = useState<"idle" | "loading" | "success">("idle");
  const actions = useChatActions();

  const handleAddToCart = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!actions || addState !== "idle") return;
    setAddState("loading");
    try {
      await actions.quickAddToCart({
        variantId: item.variantId || item.productId,
        title: item.title,
        price: parseFloat(item.price || "0"),
        imageUrl: item.imageUrl,
      });
      setAddState("success");
      setTimeout(() => setAddState("idle"), 3000);
    } catch {
      setAddState("idle");
    }
  }, [item, actions, addState]);

  const priceStr = formatPrice(item.price, item.currencyCode);

  return (
    <div className="flex items-center gap-3 py-2">
      {item.imageUrl && (
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-10 h-10 rounded-md object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.title}</p>
        {priceStr && (
          <p className="text-xs text-primary font-semibold">{priceStr}</p>
        )}
      </div>
      <button
        onClick={handleAddToCart}
        disabled={addState === "loading"}
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors min-w-[44px] min-h-[44px]"
        aria-label={`Add ${item.title} to cart`}
      >
        {addState === "loading" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : addState === "success" ? (
          <ShoppingCart className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <ShoppingCart className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

interface WishlistCardProps {
  items: WishlistItemData[];
  action?: "saved" | "removed" | "list";
  savedItem?: WishlistItemData;
  removedTitle?: string;
}

export function WishlistCard({ items, action = "list", savedItem, removedTitle }: WishlistCardProps) {
  if (action === "saved" && savedItem) {
    return (
      <div className="bg-card border border-border/50 rounded-xl p-3 mt-2">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="w-4 h-4 text-pink-500 fill-pink-500" />
          <span className="text-sm font-semibold">Saved to Wishlist</span>
        </div>
        <WishlistItemRow item={savedItem} />
        {items.length > 1 && (
          <p className="text-xs text-muted-foreground mt-1">
            {items.length} items in your wishlist
          </p>
        )}
      </div>
    );
  }

  if (action === "removed") {
    return (
      <div className="bg-card border border-border/50 rounded-xl p-3 mt-2">
        <div className="flex items-center gap-2 mb-1">
          <Trash2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Removed from Wishlist</span>
        </div>
        {removedTitle && (
          <p className="text-xs text-muted-foreground">
            "{removedTitle}" has been removed.
          </p>
        )}
        {items.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {items.length} item{items.length !== 1 ? "s" : ""} remaining
          </p>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-card border border-border/50 rounded-xl p-3 mt-2">
        <div className="flex items-center gap-2 mb-1">
          <Heart className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Your Wishlist</span>
        </div>
        <p className="text-xs text-muted-foreground">Your wishlist is empty. Ask me to save items for later!</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border/50 rounded-xl p-3 mt-2">
      <div className="flex items-center gap-2 mb-2">
        <Heart className="w-4 h-4 text-pink-500 fill-pink-500" />
        <span className="text-sm font-semibold">Your Wishlist</span>
        <span className="text-xs text-muted-foreground">({items.length} item{items.length !== 1 ? "s" : ""})</span>
      </div>
      <div className="divide-y divide-border/30">
        {items.slice(0, 10).map((item, i) => (
          <WishlistItemRow key={item.productId + i} item={item} />
        ))}
      </div>
      {items.length > 10 && (
        <p className="text-xs text-muted-foreground mt-2">
          ...and {items.length - 10} more items
        </p>
      )}
    </div>
  );
}
