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
    <div className="flex gap-3 p-3 bg-card border border-border/50 rounded-xl hover:border-primary/30 transition-colors">
      {article.image?.url && (
        <img src={article.image.url} alt={article.title || "Article"} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
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
      </div>
    </div>
  );
}
