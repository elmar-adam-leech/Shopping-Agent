import { ProductCard, type ProductCardData } from "./ProductCard";
import { CollectionCard, type CollectionCardData } from "./CollectionCard";
import { ArticleCard, type BlogArticleData } from "./ArticleCard";

interface BlogData {
  title?: string;
  handle?: string;
  articles?: { edges?: Array<{ node: BlogArticleData }> };
}

function tryParseToolResult(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function ToolResultCards({ toolName, content }: { toolName: string; content: string }) {
  const parsed = tryParseToolResult(content);
  if (!parsed || typeof parsed !== 'object') return null;

  const data = parsed as Record<string, unknown>;

  if (toolName === 'search_products' || toolName === 'get_product') {
    const products: ProductCardData[] = [];
    if (data.products && Array.isArray((data.products as Record<string, unknown>).edges)) {
      for (const edge of (data.products as { edges: Array<{ node: ProductCardData }> }).edges) {
        products.push(edge.node);
      }
    } else if (data.product && typeof data.product === 'object') {
      products.push(data.product as ProductCardData);
    } else if (Array.isArray(data)) {
      products.push(...(data as ProductCardData[]));
    }

    if (products.length === 0) return null;

    return (
      <div className="grid gap-2 mt-2">
        {products.slice(0, 6).map((p, i) => (
          <ProductCard key={i} product={p} />
        ))}
      </div>
    );
  }

  if (toolName === 'get_collections') {
    const collections: CollectionCardData[] = [];
    if (data.collections && Array.isArray((data.collections as Record<string, unknown>).edges)) {
      for (const edge of (data.collections as { edges: Array<{ node: CollectionCardData }> }).edges) {
        collections.push(edge.node);
      }
    }

    if (collections.length === 0) return null;

    return (
      <div className="grid gap-2 mt-2">
        {collections.slice(0, 6).map((c, i) => (
          <CollectionCard key={i} collection={c} />
        ))}
      </div>
    );
  }

  if (toolName === 'get_blogs') {
    const articles: BlogArticleData[] = [];
    if (data.blogs && Array.isArray((data.blogs as Record<string, unknown>).edges)) {
      for (const blogEdge of (data.blogs as { edges: Array<{ node: BlogData }> }).edges) {
        const blog = blogEdge.node;
        if (blog.articles?.edges) {
          for (const articleEdge of blog.articles.edges) {
            articles.push(articleEdge.node);
          }
        }
      }
    }

    if (articles.length === 0) return null;

    return (
      <div className="grid gap-2 mt-2">
        {articles.slice(0, 6).map((a, i) => (
          <ArticleCard key={i} article={a} />
        ))}
      </div>
    );
  }

  return null;
}
