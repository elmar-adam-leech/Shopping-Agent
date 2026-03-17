import { useRoute } from "wouter";
import { useEmbedMode } from "@/hooks/use-embed-mode";
import { ContextualAssistantButton } from "@/components/embed/ContextualAssistantButton";

export default function EmbedAssistantPage() {
  const [, params] = useRoute("/embed/:storeDomain/assistant");
  const storeDomain = params?.storeDomain || "";
  const { productHandle, collectionHandle, cartToken } = useEmbedMode();

  return (
    <div className="h-screen w-full flex items-center justify-center">
      <ContextualAssistantButton
        storeDomain={storeDomain}
        productHandle={productHandle}
        collectionHandle={collectionHandle}
        cartToken={cartToken}
        expanded
      />
    </div>
  );
}
