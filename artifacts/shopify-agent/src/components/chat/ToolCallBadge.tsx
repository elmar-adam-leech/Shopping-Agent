import { Search, Tag, Package, ShoppingBag, RefreshCw } from "lucide-react";

export interface ToolCallDisplay {
  id: string;
  name: string;
  arguments: string;
}

export function ToolCallBadge({ tc }: { tc: ToolCallDisplay }) {
  const iconMap: Record<string, React.ReactNode> = {
    search_products: <Search className="w-3.5 h-3.5" />,
    get_product: <Package className="w-3.5 h-3.5" />,
    get_collections: <Tag className="w-3.5 h-3.5" />,
    get_blogs: <Tag className="w-3.5 h-3.5" />,
    add_to_cart: <ShoppingBag className="w-3.5 h-3.5" />,
    create_cart: <ShoppingBag className="w-3.5 h-3.5" />,
    get_cart: <ShoppingBag className="w-3.5 h-3.5" />,
  };
  const labelMap: Record<string, string> = {
    search_products: "Searching products...",
    get_product: "Getting product details...",
    get_collections: "Fetching collections...",
    add_to_cart: "Added to cart!",
    create_cart: "Creating cart...",
    get_cart: "Loading cart...",
    get_blogs: "Fetching articles...",
  };

  if (tc.name === 'add_to_cart') {
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
      <span aria-hidden="true">{iconMap[tc.name] || <RefreshCw className="w-3 h-3" />}</span>
      {labelMap[tc.name] || `Using ${tc.name}...`}
    </div>
  );
}
