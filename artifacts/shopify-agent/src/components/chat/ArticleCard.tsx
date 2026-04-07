import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Calendar, User } from "lucide-react";
import DOMPurify from "dompurify";

export interface BlogArticleData {
  title?: string;
  handle?: string;
  excerpt?: string;
  contentHtml?: string;
  content?: string;
  publishedAt?: string;
  authorV2?: { name?: string };
  image?: { url?: string; altText?: string };
  blog?: { title?: string };
}

export function ArticleCard({ article }: { article: BlogArticleData }) {
  const [expanded, setExpanded] = useState(false);
  const authorName = article.authorV2?.name;
  const hasFullContent = !!(article.contentHtml || article.content);
  const sanitizedHtml = useMemo(
    () => (article.contentHtml ? DOMPurify.sanitize(article.contentHtml) : ""),
    [article.contentHtml]
  );

  return (
    <div className="bg-card border border-border/50 rounded-xl overflow-hidden hover:border-primary/30 transition-colors">
      {article.image?.url && (
        <img
          src={article.image.url}
          alt={article.image.altText || article.title || "Article"}
          className="w-full h-36 object-cover"
        />
      )}
      <div className="p-3">
        {article.blog?.title && (
          <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1">
            {article.blog.title}
          </p>
        )}
        <h4 className="font-semibold text-sm leading-snug">{article.title}</h4>

        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground/70">
          {authorName && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {authorName}
            </span>
          )}
          {article.publishedAt && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(article.publishedAt).toLocaleDateString()}
            </span>
          )}
        </div>

        {article.excerpt && !expanded && (
          <p className="text-xs text-muted-foreground line-clamp-3 mt-2">{article.excerpt}</p>
        )}

        {hasFullContent && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-primary font-medium mt-2 hover:underline"
            >
              {expanded ? (
                <>
                  Show less <ChevronUp className="w-3 h-3" />
                </>
              ) : (
                <>
                  Read more <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>

            {expanded && (
              <div className="mt-2 border-t border-border/30 pt-2">
                {sanitizedHtml ? (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed [&_img]:rounded-lg [&_img]:max-h-48 [&_a]:text-primary"
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{article.content}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
