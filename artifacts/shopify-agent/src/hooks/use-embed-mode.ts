import { useMemo } from 'react';

export interface EmbedModeConfig {
  isEmbed: boolean;
  productHandle?: string;
  collectionHandle?: string;
  cartToken?: string;
  initialMessage?: string;
}

export function useEmbedMode(): EmbedModeConfig {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const isEmbed = params.get('mode') === 'embed' || window !== window.parent;

    return {
      isEmbed,
      productHandle: params.get('productHandle') || undefined,
      collectionHandle: params.get('collectionHandle') || undefined,
      cartToken: params.get('cartToken') || undefined,
      initialMessage: params.get('initialMessage') || undefined,
    };
  }, []);
}
