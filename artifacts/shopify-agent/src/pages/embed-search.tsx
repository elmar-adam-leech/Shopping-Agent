import { useRoute } from "wouter";
import { AISearchBar } from "@/components/embed/AISearchBar";

export default function EmbedSearchPage() {
  const [, params] = useRoute("/embed/:storeDomain/search");
  const storeDomain = params?.storeDomain || "";

  return (
    <div className="h-screen w-full">
      <AISearchBar storeDomain={storeDomain} />
    </div>
  );
}
