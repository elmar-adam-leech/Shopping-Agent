import { create } from 'zustand';

export interface CartItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  variantId?: string;
  variantTitle?: string;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  previousSnapshot: CartItem[] | null;
  lastEditDescription: string | null;
  setIsOpen: (isOpen: boolean) => void;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  swapItem: (oldId: string, newItem: Omit<CartItem, 'quantity'>, description?: string) => void;
  undoLastEdit: () => void;
  clearCart: () => void;
  get totalItems(): number;
  get subtotal(): number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  isOpen: false,
  previousSnapshot: null,
  lastEditDescription: null,
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
    previousSnapshot: [...state.items],
    lastEditDescription: `Removed "${state.items.find(i => i.id === id)?.title || 'item'}"`,
    items: state.items.filter(i => i.id !== id)
  })),
  updateQuantity: (id, quantity) => set((state) => ({
    previousSnapshot: [...state.items],
    lastEditDescription: `Changed quantity of "${state.items.find(i => i.id === id)?.title || 'item'}"`,
    items: quantity <= 0 
      ? state.items.filter(i => i.id !== id)
      : state.items.map(i => i.id === id ? { ...i, quantity } : i)
  })),
  swapItem: (oldId, newItem, description) => set((state) => {
    const snapshot = [...state.items];
    const oldIndex = state.items.findIndex(i => i.id === oldId);
    const oldItemTitle = oldIndex >= 0 ? state.items[oldIndex].title : 'item';
    const updatedItems = [...state.items];
    if (oldIndex >= 0) {
      const oldQuantity = updatedItems[oldIndex].quantity;
      updatedItems[oldIndex] = { ...newItem, quantity: oldQuantity };
    } else {
      updatedItems.push({ ...newItem, quantity: 1 });
    }
    return {
      items: updatedItems,
      previousSnapshot: snapshot,
      lastEditDescription: description || `Swapped "${oldItemTitle}" for "${newItem.title}"`,
      isOpen: true
    };
  }),
  undoLastEdit: () => set((state) => {
    if (!state.previousSnapshot) return {};
    return {
      items: state.previousSnapshot,
      previousSnapshot: null,
      lastEditDescription: null
    };
  }),
  clearCart: () => set({ items: [], previousSnapshot: null, lastEditDescription: null }),
  get totalItems() {
    return get().items.reduce((total, item) => total + item.quantity, 0);
  },
  get subtotal() {
    return get().items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }
}));
