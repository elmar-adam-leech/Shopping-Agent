import { useRoute } from "wouter";
import { EmbedChatPanel } from "@/components/embed/EmbedChatPanel";
import { useEmbedMode } from "@/hooks/use-embed-mode";

export default function EmbedChatPage() {
  const [, params] = useRoute("/embed/:storeDomain/chat");
  const storeDomain = params?.storeDomain || "";
  const { productHandle, collectionHandle, cartToken, initialMessage } = useEmbedMode();

  return (
    <div className="h-screen w-full">
      <EmbedChatPanel
        storeDomain={storeDomain}
        productHandle={productHandle}
        collectionHandle={collectionHandle}
        cartToken={cartToken}
        initialMessage={initialMessage}
      />
    </div>
  );
}
