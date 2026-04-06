import { createContext, useContext } from "react";

export interface QuickAddProduct {
  variantId: string;
  title: string;
  price: number;
  imageUrl?: string;
}

interface ChatActions {
  sendMessage: (content: string) => Promise<void>;
  quickAddToCart: (product: QuickAddProduct) => Promise<void>;
  isLoading: boolean;
}

const ChatActionsContext = createContext<ChatActions | null>(null);

export function ChatActionsProvider({
  children,
  sendMessage,
  quickAddToCart,
  isLoading,
}: ChatActions & { children: React.ReactNode }) {
  return (
    <ChatActionsContext.Provider value={{ sendMessage, quickAddToCart, isLoading }}>
      {children}
    </ChatActionsContext.Provider>
  );
}

export function useChatActions(): ChatActions | null {
  return useContext(ChatActionsContext);
}
