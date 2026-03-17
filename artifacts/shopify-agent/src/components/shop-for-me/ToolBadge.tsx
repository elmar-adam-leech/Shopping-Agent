import { Sparkles, Search, Package, Tag } from "lucide-react";

const TOOL_LABELS: Record<string, string> = {
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

const TOOL_ICONS: Record<string, typeof Search> = {
  search_products: Search,
  get_product: Package,
  get_collections: Tag,
  get_product_recommendations: Sparkles,
};

export function ToolBadge({ name }: { name: string }) {
  const label = TOOL_LABELS[name] || name;
  const Icon = TOOL_ICONS[name] || Sparkles;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
