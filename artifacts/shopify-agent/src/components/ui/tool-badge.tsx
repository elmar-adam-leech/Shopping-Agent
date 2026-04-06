import type { ReactNode } from "react";
import { Search, Tag, Package, ShoppingBag, RefreshCw, Sparkles } from "lucide-react";

export interface ToolCallDisplay {
  id: string;
  name: string;
  arguments: string;
}

const ICON_MAP: Record<string, ReactNode> = {
  search_products: <Search className="w-3.5 h-3.5" />,
  get_product: <Package className="w-3.5 h-3.5" />,
  get_collections: <Tag className="w-3.5 h-3.5" />,
  list_collections: <Tag className="w-3.5 h-3.5" />,
  get_blogs: <Tag className="w-3.5 h-3.5" />,
  list_blogs: <Tag className="w-3.5 h-3.5" />,
  add_to_cart: <ShoppingBag className="w-3.5 h-3.5" />,
  create_cart: <ShoppingBag className="w-3.5 h-3.5" />,
  get_cart: <ShoppingBag className="w-3.5 h-3.5" />,
  get_product_recommendations: <Sparkles className="w-3.5 h-3.5" />,
};

const LABEL_MAP: Record<string, string> = {
  search_products: "Searching products...",
  get_product: "Getting product details...",
  get_collections: "Fetching collections...",
  list_collections: "Browsing collections...",
  add_to_cart: "Added to cart!",
  create_cart: "Creating cart...",
  get_cart: "Loading cart...",
  get_blogs: "Fetching articles...",
  list_blogs: "Reading blog posts...",
  get_product_recommendations: "Finding recommendations...",
};

const COMPACT_LABEL_MAP: Record<string, string> = {
  search_products: "Searching products",
  get_product: "Looking up product",
  get_collections: "Browsing collections",
  list_collections: "Browsing collections",
  get_blogs: "Reading blog posts",
  list_blogs: "Reading blog posts",
  add_to_cart: "Adding to cart",
  get_cart: "Checking cart",
  get_product_recommendations: "Finding recommendations",
};

const COMPACT_ICON_MAP: Record<string, typeof Search> = {
  search_products: Search,
  get_product: Package,
  get_collections: Tag,
  get_product_recommendations: Sparkles,
};

interface ToolBadgeProps {
  name: string;
  variant?: "detailed" | "compact";
}

export function ToolBadge({ name, variant = "compact" }: ToolBadgeProps) {
  if (variant === "detailed") {
    if (name === "add_to_cart") {
      return (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-center gap-3 text-sm text-emerald-800 dark:text-emerald-300" role="status">
          <div className="bg-emerald-100 dark:bg-emerald-800/50 p-2 rounded-lg" aria-hidden="true">
            <ShoppingBag className="w-4 h-4" />
          </div>
          Added an item to your cart!
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium bg-secondary/30 px-3 py-1.5 rounded-full w-fit border border-border/50" role="status">
        <span aria-hidden="true">{ICON_MAP[name] || <RefreshCw className="w-3 h-3" />}</span>
        {LABEL_MAP[name] || `Using ${name}...`}
      </div>
    );
  }

  const label = COMPACT_LABEL_MAP[name] || name;
  const Icon = COMPACT_ICON_MAP[name] || Sparkles;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

