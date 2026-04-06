import { Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface AgentAvatarProps {
  icon?: LucideIcon;
  size?: "sm" | "md" | "lg";
  variant?: "subtle" | "gradient";
  children?: ReactNode;
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8 rounded-lg",
  md: "w-12 h-12 rounded-2xl",
  lg: "w-14 h-14 rounded-xl",
};

const iconSizeClasses = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-7 h-7",
};

const variantClasses = {
  subtle: "bg-primary/10 text-primary",
  gradient: "bg-gradient-to-tr from-primary to-accent text-white shadow-lg shadow-primary/20",
};

export function AgentAvatar({
  icon: Icon = Sparkles,
  size = "sm",
  variant = "subtle",
  children,
  className = "",
}: AgentAvatarProps) {
  return (
    <div
      className={`${sizeClasses[size]} ${variantClasses[variant]} flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      {children || <Icon className={iconSizeClasses[size]} />}
    </div>
  );
}
