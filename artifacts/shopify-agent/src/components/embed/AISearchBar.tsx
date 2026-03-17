import { useState, useRef, useCallback } from "react";
import { Search, Loader2, X } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { ProductCard, type ProductCardData } from "@/components/chat/ProductCard";
import { readSSEStream } from "@/lib/sse-parser";

interface AISearchBarProps {
  storeDomain: string;
}

export function AISearchBar({ storeDomain }: AISearchBarProps) {
  const sessionId = useSession(storeDomain);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductCardData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchSummary, setSummary] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !sessionId) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsSearching(true);
    setResults([]);
    setSummary("");

    try {
      const response = await fetch(`/api/stores/${storeDomain}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: `Search for products matching: "${searchQuery}". Use the search_products tool and show results.`,
          context: { searchMode: true },
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) throw new Error("Search failed");

      let fullText = "";

      await readSSEStream(
        response.body,
        (event) => {
          if (event.type === "text") {
            fullText += event.data as string;
            setSummary(fullText);
          } else if (event.type === "tool_result") {
            try {
              const content = (event.data as { content: string }).content;
              const parsed = JSON.parse(content);
              const products: ProductCardData[] = [];

              if (Array.isArray(parsed)) {
                products.push(...parsed);
              } else if (parsed.products && Array.isArray(parsed.products)) {
                products.push(...parsed.products);
              } else if (parsed.edges && Array.isArray(parsed.edges)) {
                products.push(...parsed.edges.map((e: { node: ProductCardData }) => e.node));
              }

              if (products.length > 0) {
                setResults((prev) => [...prev, ...products]);
              }
            } catch {
              console.warn("Could not parse product data from tool result");
            }
          }
        },
        abortRef.current.signal
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Search error:", err);
      }
    } finally {
      setIsSearching(false);
    }
  }, [storeDomain, sessionId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setSummary("");
    abortRef.current?.abort();
    setIsSearching(false);
  };

  return (
    <div className="flex flex-col h-full bg-background p-4">
      <form onSubmit={handleSubmit} className="relative mb-4">
        <div className="relative flex items-center bg-card border border-border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
          <Search className="w-5 h-5 text-muted-foreground ml-4 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products with AI..."
            className="flex-1 bg-transparent border-0 outline-none px-3 py-3.5 text-sm"
          />
          {query && (
            <button type="button" onClick={clearSearch} className="p-2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
          {isSearching && <Loader2 className="w-5 h-5 animate-spin text-primary mr-3" />}
        </div>
      </form>

      <div className="flex-1 overflow-y-auto space-y-3">
        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((product, i) => (
              <ProductCard key={product.handle || product.id || i} product={product} />
            ))}
          </div>
        )}

        {searchSummary && (
          <div className="text-sm text-muted-foreground bg-secondary/30 rounded-xl p-4 mt-2">
            {searchSummary}
          </div>
        )}

        {!isSearching && !results.length && !searchSummary && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Search className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">Search for products using natural language</p>
          </div>
        )}
      </div>
    </div>
  );
}
