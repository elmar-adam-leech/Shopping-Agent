import { create } from 'zustand';

export interface CartItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  variantId?: string;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  get totalItems(): number;
  get subtotal(): number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  isOpen: false,
  setIsOpen: (isOpen) => set({ isOpen }),
  addItem: (newItem) => set((state) => {
    const existing = state.items.find(i => i.id === newItem.id);
    if (existing) {
      return {
        items: state.items.map(i => 
          i.id === newItem.id ? { ...i, quantity: i.quantity + 1 } : i
        ),
        isOpen: true
      };
    }
    return { items: [...state.items, { ...newItem, quantity: 1 }], isOpen: true };
  }),
  removeItem: (id) => set((state) => ({
    items: state.items.filter(i => i.id !== id)
  })),
  updateQuantity: (id, quantity) => set((state) => ({
    items: quantity <= 0 
      ? state.items.filter(i => i.id !== id)
      : state.items.map(i => i.id === id ? { ...i, quantity } : i)
  })),
  clearCart: () => set({ items: [] }),
  get totalItems() {
    return get().items.reduce((total, item) => total + item.quantity, 0);
  },
  get subtotal() {
    return get().items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }
}));
