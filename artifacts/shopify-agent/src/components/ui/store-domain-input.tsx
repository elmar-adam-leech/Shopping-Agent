import * as React from "react";
import { cn } from "@/lib/utils";

interface StoreDomainInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> {
  className?: string;
  inputClassName?: string;
}

export function StoreDomainInput({
  className,
  inputClassName,
  placeholder = "your-store",
  ...inputProps
}: StoreDomainInputProps) {
  return (
    <div
      className={cn(
        "flex items-center rounded-xl border overflow-hidden focus-within:ring-2",
        className
      )}
    >
      <input
        type="text"
        placeholder={placeholder}
        {...inputProps}
        className={cn(
          "flex-1 px-4 py-3 bg-transparent focus:outline-none border-0 placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          inputClassName
        )}
      />
      <span className="pr-4 text-muted-foreground text-sm font-medium whitespace-nowrap select-none">
        .myshopify.com
      </span>
    </div>
  );
}
