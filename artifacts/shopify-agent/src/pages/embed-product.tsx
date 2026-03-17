import { useRoute } from "wouter";
import { ProductAssistant } from "@/components/embed/ProductAssistant";

export default function EmbedProductPage() {
  const [, params] = useRoute("/embed/:storeDomain/product/:productHandle");
  const storeDomain = params?.storeDomain || "";
  const productHandle = params?.productHandle || "";

  return (
    <div className="h-screen w-full p-4">
      <ProductAssistant storeDomain={storeDomain} productHandle={productHandle} />
    </div>
  );
}
