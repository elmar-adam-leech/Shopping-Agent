import { X, ShoppingBag, Trash2, Plus, Minus, CreditCard, Undo2 } from "lucide-react";
import { useCartStore } from "@/store/use-cart-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export function CartPanel() {
  const cart = useCartStore();

  if (!cart.isOpen) return null;

  return (
    <aside aria-label="Shopping cart" className="w-[350px] h-full bg-card border-l border-border/50 shadow-2xl flex flex-col absolute right-0 top-0 z-40 animate-in slide-in-from-right duration-300" role="complementary">
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-background/50 backdrop-blur-md">
        <h2 className="flex items-center gap-2 font-display font-semibold">
          <ShoppingBag className="w-5 h-5 text-primary" aria-hidden="true" />
          Live Cart Preview
        </h2>
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-secondary" onClick={() => cart.setIsOpen(false)} aria-label="Close cart panel">
          <X className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {cart.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground space-y-3">
            <ShoppingBag className="w-12 h-12 opacity-20" aria-hidden="true" />
            <p>Your cart is empty.<br/>Ask the agent to add products!</p>
          </div>
        ) : (
          <div className="space-y-4" role="list" aria-label="Cart items">
            {cart.items.map(item => (
              <div key={item.id} className="flex gap-4 p-3 rounded-xl bg-secondary/20 border border-border/30 group" role="listitem">
                <div className="w-16 h-16 rounded-lg bg-secondary/50 flex-shrink-0 overflow-hidden">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs font-medium" aria-label={`${item.title} - no image available`}>No Img</div>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="text-sm font-medium leading-tight truncate">{item.title}</h4>
                    <button 
                      onClick={() => cart.removeItem(item.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring rounded"
                      aria-label={`Remove ${item.title} from cart`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-semibold text-primary text-sm">${item.price.toFixed(2)}</span>
                    <div className="flex items-center gap-2 bg-background rounded-md border border-border/50 p-1" role="group" aria-label={`Quantity for ${item.title}`}>
                      <button onClick={() => cart.updateQuantity(item.id, item.quantity - 1)} className="p-0.5 hover:bg-secondary rounded focus:outline-none focus:ring-2 focus:ring-ring" aria-label={`Decrease quantity of ${item.title}`}>
                        <Minus className="w-3 h-3" aria-hidden="true" />
                      </button>
                      <span className="text-xs font-medium w-4 text-center" aria-live="polite">{item.quantity}</span>
                      <button onClick={() => cart.updateQuantity(item.id, item.quantity + 1)} className="p-0.5 hover:bg-secondary rounded focus:outline-none focus:ring-2 focus:ring-ring" aria-label={`Increase quantity of ${item.title}`}>
                        <Plus className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-border/50 bg-background/50 backdrop-blur-md">
        {cart.previousSnapshot && (
          <button
            onClick={() => cart.undoLastEdit()}
            className="w-full mb-3 flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Undo last cart change"
          >
            <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
            Undo: {cart.lastEditDescription || "last change"}
          </button>
        )}
        <div className="space-y-2 mb-4 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>${cart.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Shipping</span>
            <span>Calculated at checkout</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span className="text-primary">${cart.subtotal.toFixed(2)}</span>
          </div>
        </div>
        <Button className="w-full font-bold shadow-lg shadow-primary/20 group" disabled={cart.items.length === 0}>
          <CreditCard className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" aria-hidden="true" />
          Go to Checkout
        </Button>
      </div>
    </aside>
  );
}
