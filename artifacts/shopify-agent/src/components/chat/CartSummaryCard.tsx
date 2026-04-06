import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/use-cart-store";
import { Button } from "@/components/ui/button";

export function CartSummaryCard() {
  const cart = useCartStore();

  if (cart.items.length === 0) return null;

  return (
    <div className="mt-2 flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
      <div className="bg-emerald-100 dark:bg-emerald-800/50 p-2 rounded-lg flex-shrink-0">
        <ShoppingBag className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
          {cart.totalItems} {cart.totalItems === 1 ? "item" : "items"} in cart
        </p>
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          Subtotal: ${cart.subtotal.toFixed(2)}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-800/50 flex-shrink-0 min-h-[44px] min-w-[44px]"
        onClick={() => cart.setIsOpen(true)}
      >
        View Cart
      </Button>
    </div>
  );
}
