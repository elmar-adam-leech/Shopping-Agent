import { Sparkles } from "lucide-react";
import { ProductCard, type ProductCardData } from "./ProductCard";
import { ProductCarousel } from "./ProductCarousel";

interface CrossSellCardProps {
  products: ProductCardData[];
  heading?: string;
}

export function CrossSellCard({ products, heading }: CrossSellCardProps) {
  if (products.length === 0) return null;

  const title = heading || "You might also like";

  if (products.length >= 3) {
    return (
      <div className="mt-2">
        <div className="flex items-center gap-2 mb-2 px-1">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <ProductCarousel products={products.slice(0, 8)} />
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="grid gap-2">
        {products.slice(0, 4).map((p, i) => (
          <ProductCard key={i} product={p} />
        ))}
      </div>
    </div>
  );
}
