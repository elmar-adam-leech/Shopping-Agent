import type { ProductCardData } from "./ProductCard";

interface ComparisonTableProps {
  products: ProductCardData[];
}

function formatPrice(product: ProductCardData): string {
  const price = product.priceRange?.minVariantPrice;
  if (!price?.amount) return "N/A";
  const symbol = price.currencyCode === "USD" ? "$" : (price.currencyCode || "");
  return `${symbol}${price.amount}`;
}

function getAvailability(product: ProductCardData): string {
  if (typeof product.availableForSale === "boolean") {
    return product.availableForSale ? "In Stock" : "Out of Stock";
  }
  const firstVariant = product.variants?.edges?.[0]?.node;
  if (firstVariant && typeof firstVariant.availableForSale === "boolean") {
    return firstVariant.availableForSale ? "In Stock" : "Out of Stock";
  }
  return "—";
}

function collectOptionNames(products: ProductCardData[]): string[] {
  const nameSet = new Set<string>();
  for (const p of products) {
    if (p.options) {
      for (const opt of p.options) {
        if (opt.name && opt.name !== "Title") {
          nameSet.add(opt.name);
        }
      }
    }
  }
  return Array.from(nameSet);
}

function getOptionValues(product: ProductCardData, optionName: string): string {
  if (!product.options) return "—";
  const option = product.options.find((o) => o.name === optionName);
  if (!option?.values || option.values.length === 0) return "—";
  return option.values.join(", ");
}

export function ComparisonTable({ products }: ComparisonTableProps) {
  const baseRows: { label: string; getter: (p: ProductCardData) => string }[] = [
    { label: "Price", getter: formatPrice },
    { label: "Vendor", getter: (p) => p.vendor || "N/A" },
    { label: "Availability", getter: getAvailability },
  ];

  const hasProductType = products.some((p) => p.productType);
  if (hasProductType) {
    baseRows.push({ label: "Type", getter: (p) => p.productType || "—" });
  }

  const optionNames = collectOptionNames(products);
  for (const name of optionNames) {
    baseRows.push({ label: name, getter: (p) => getOptionValues(p, name) });
  }

  const hasTags = products.some((p) => p.tags && p.tags.length > 0);
  if (hasTags) {
    baseRows.push({
      label: "Tags",
      getter: (p) => (p.tags && p.tags.length > 0 ? p.tags.slice(0, 5).join(", ") : "—"),
    });
  }

  return (
    <div className="mt-2 overflow-x-auto rounded-xl border border-border/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50 bg-secondary/20">
            <th className="p-3 text-left text-xs font-medium text-muted-foreground w-[100px]" />
            {products.map((p, i) => (
              <th key={i} className="p-3 text-center min-w-[140px]">
                <div className="flex flex-col items-center gap-2">
                  {(p.featuredImage?.url || p.images?.edges?.[0]?.node?.url) && (
                    <img
                      src={p.featuredImage?.url || p.images?.edges?.[0]?.node?.url}
                      alt={p.title || "Product"}
                      className="w-14 h-14 rounded-lg object-cover"
                    />
                  )}
                  <span className="font-semibold text-xs leading-tight line-clamp-2">
                    {p.title}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baseRows.map((row, ri) => (
            <tr
              key={ri}
              className={ri % 2 === 0 ? "bg-background" : "bg-secondary/10"}
            >
              <td className="p-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                {row.label}
              </td>
              {products.map((p, pi) => (
                <td key={pi} className="p-3 text-center text-xs font-medium">
                  {row.getter(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
