import { EntityCard } from "@/components/ui/entity-card";

export interface BlogArticleData {
  title?: string;
  handle?: string;
  excerpt?: string;
  publishedAt?: string;
  image?: { url?: string; altText?: string };
  blog?: { title?: string };
}

export function ArticleCard({ article }: { article: BlogArticleData }) {
  return (
    <EntityCard imageUrl={article.image?.url} imageAlt={article.title || "Article"}>
      <h4 className="font-semibold text-sm truncate">{article.title}</h4>
      {article.blog?.title && <p className="text-xs text-primary font-medium">{article.blog.title}</p>}
      {article.excerpt && (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{article.excerpt}</p>
      )}
      {article.publishedAt && (
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          {new Date(article.publishedAt).toLocaleDateString()}
        </p>
      )}
    </EntityCard>
  );
}
