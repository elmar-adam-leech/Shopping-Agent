import { useState } from "react";
import { ShoppingCart, RefreshCw, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface RecoveryCartItem {
  title: string;
  quantity: number;
  price: number;
  variantId?: string;
  imageUrl?: string | null;
}

interface CheckoutRecoveryCardProps {
  cartItems: RecoveryCartItem[];
  cartTotal: number;
  abandonedAt: string;
  onResume: () => void;
  onDismiss: () => void;
  onStartFresh: () => void;
}

export function CheckoutRecoveryCard({
  cartItems,
  cartTotal,
  abandonedAt,
  onResume,
  onDismiss,
  onStartFresh,
}: CheckoutRecoveryCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const timeAgo = getTimeAgo(abandonedAt);

  return (
    <div className="mx-auto max-w-2xl mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-amber-100/50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <div className="bg-amber-200 dark:bg-amber-800/50 p-1.5 rounded-lg">
              <ShoppingCart className="w-4 h-4 text-amber-700 dark:text-amber-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Welcome back!
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                You left some items in your cart {timeAgo}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setDismissed(true);
              onDismiss();
            }}
            className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 p-1 rounded-md hover:bg-amber-200/50 dark:hover:bg-amber-800/50 transition-colors"
            aria-label="Dismiss recovery prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {cartItems.length > 0 && (
          <div className="px-4 py-3 space-y-2">
            {cartItems.slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-8 h-8 rounded-md object-cover flex-shrink-0"
                    />
                  )}
                  <span className="text-amber-900 dark:text-amber-100 truncate">
                    {item.title}
                  </span>
                  {item.quantity > 1 && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 flex-shrink-0">
                      ×{item.quantity}
                    </span>
                  )}
                </div>
                <span className="text-amber-800 dark:text-amber-200 font-medium flex-shrink-0 ml-2">
                  ${(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
            {cartItems.length > 5 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                +{cartItems.length - 5} more items
              </p>
            )}
            {cartTotal > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-amber-200 dark:border-amber-700">
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">Total</span>
                <span className="text-sm font-bold text-amber-900 dark:text-amber-100">
                  ${cartTotal.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="px-4 py-3 flex flex-wrap gap-2 border-t border-amber-200 dark:border-amber-800">
          <Button
            onClick={onResume}
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 min-h-[44px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Resume Checkout
          </Button>
          <Button
            onClick={onStartFresh}
            variant="outline"
            size="sm"
            className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/50 gap-1.5 min-h-[44px]"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            Start Fresh
          </Button>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffMins > 0) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  return "just now";
}
