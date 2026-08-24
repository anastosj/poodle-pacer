import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  const variants = {
    primary: "bg-primary text-white",
    secondary: "bg-highlight text-ink",
    ghost: "bg-surface text-ink hover:bg-lilac",
    danger: "bg-red-100 text-red-900",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  return (
    <button
      className={`hard-button focus-pouf inline-flex items-center justify-center rounded-sm font-bold uppercase ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
