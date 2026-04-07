import { useState } from "react";
import { ArrowRight, Check, X, Undo2, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/use-cart-store";

interface CartEditItem {
  id: string;
  title: string;
  variantTitle?: string;
  price: number;
  imageUrl?: string;
  quantity?: number;
}

export interface CartEditPreviewData {
  _cartEditPreview: true;
  action: "swap" | "variant_change" | "remove";
  oldItem: CartEditItem;
  newItem?: CartEditItem;
  reason?: string;
}

function PriceTag({ amount, className }: { amount: number; className?: string }) {
  return <span className={className}>${amount.toFixed(2)}</span>;
}

function ItemPreview({ item, label, muted }: { item: CartEditItem; label: string; muted?: boolean }) {
  return (
    <div className={`flex gap-3 p-3 rounded-lg ${muted ? "bg-muted/30 opacity-60" : "bg-secondary/30"}`}>
      <div className="w-14 h-14 rounded-md bg-secondary/50 flex-shrink-0 overflow-hidden">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No Img</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">{label}</p>
        <p className="text-sm font-medium leading-tight truncate">{item.title}</p>
        {item.variantTitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{item.variantTitle}</p>
        )}
        <PriceTag amount={item.price} className="text-sm font-semibold text-primary mt-1 block" />
      </div>
    </div>
  );
}

export function CartEditPreviewCard({ data }: { data: CartEditPreviewData }) {
  const cart = useCartStore();
  const [status, setStatus] = useState<"pending" | "confirmed" | "cancelled">("pending");

  const priceDiff = data.newItem ? data.newItem.price - data.oldItem.price : -data.oldItem.price;
  const oldQty = data.oldItem.quantity ?? 1;
  const currentSubtotal = cart.subtotal;
  const newSubtotal = currentSubtotal + (priceDiff * oldQty);

  const handleConfirm = () => {
    if (data.action === "remove") {
      cart.removeItem(data.oldItem.id);
      setStatus("confirmed");
    } else if (data.newItem) {
      cart.swapItem(
        data.oldItem.id,
        {
          id: data.newItem.id,
          title: data.newItem.title,
          price: data.newItem.price,
          imageUrl: data.newItem.imageUrl,
          variantId: data.newItem.id,
          variantTitle: data.newItem.variantTitle,
        },
        data.reason
      );
      setStatus("confirmed");
    }
  };

  const handleCancel = () => {
    setStatus("cancelled");
  };

  const handleUndo = () => {
    cart.undoLastEdit();
    setStatus("pending");
  };

  const actionLabel = data.action === "remove" ? "Remove Item" : data.action === "variant_change" ? "Change Variant" : "Swap Item";

  return (
    <div className="mt-2 border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm">
      <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-border/30 flex items-center gap-2">
        <span className="text-amber-700 dark:text-amber-300 text-xs font-semibold uppercase tracking-wider">
          {actionLabel} Preview
        </span>
        {status === "confirmed" && (
          <span className="ml-auto text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <Check className="w-3 h-3" /> Confirmed
          </span>
        )}
        {status === "cancelled" && (
          <span className="ml-auto text-xs font-medium text-muted-foreground flex items-center gap-1">
            <X className="w-3 h-3" /> Cancelled
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {data.reason && (
          <p className="text-xs text-muted-foreground italic">{data.reason}</p>
        )}

        {data.action === "remove" ? (
          <div className="flex items-center gap-3">
            <ItemPreview item={data.oldItem} label="Removing" muted />
            <Minus className="w-5 h-5 text-destructive flex-shrink-0" />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <ItemPreview item={data.oldItem} label="Current" muted />
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              {data.newItem && <ItemPreview item={data.newItem} label="New" />}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border/30 text-xs">
          <span className="text-muted-foreground">Price difference</span>
          <span className={`font-semibold ${priceDiff > 0 ? "text-amber-600 dark:text-amber-400" : priceDiff < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
            {priceDiff > 0 ? "+" : ""}{priceDiff === 0 ? "No change" : `$${priceDiff.toFixed(2)}`}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">New subtotal</span>
          <span className="font-semibold text-foreground">${newSubtotal.toFixed(2)}</span>
        </div>
      </div>

      {status === "pending" && (
        <div className="px-4 pb-4 flex gap-2">
          <Button
            onClick={handleConfirm}
            size="sm"
            className="flex-1 min-h-[44px]"
          >
            <Check className="w-4 h-4 mr-1.5" />
            Confirm Change
          </Button>
          <Button
            onClick={handleCancel}
            variant="outline"
            size="sm"
            className="flex-1 min-h-[44px]"
          >
            <X className="w-4 h-4 mr-1.5" />
            Cancel
          </Button>
        </div>
      )}

      {status === "confirmed" && (
        <div className="px-4 pb-4">
          <Button
            onClick={handleUndo}
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground hover:text-foreground min-h-[44px]"
          >
            <Undo2 className="w-4 h-4 mr-1.5" />
            Undo this change
          </Button>
        </div>
      )}
    </div>
  );
}
