import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  // Orange is the accent, but only the darker `orange-ink` reaches AA behind
  // white text — see the contrast note in globals.css.
  primary: "bg-brand-orange-ink text-white hover:bg-brand-orange",
  secondary: "bg-brand-blue text-white hover:bg-brand-blue-dark",
  ghost: "bg-transparent text-brand-blue hover:bg-brand-blue-soft",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizeClasses: Record<ButtonSize, string> = {
  // min-h-11 keeps every button at a comfortable touch target on mobile.
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-base",
  lg: "min-h-13 px-6 text-lg",
};

/**
 * The button's look, without the button.
 *
 * Extracted so a `<Link>` can carry it. A link that navigates must stay a
 * link — wrapping it in a `<button>` would lose middle-click, "open in new
 * tab" and the keyboard behaviour a browser gives anchors for free. Sharing
 * the classes rather than the element keeps the two identical without
 * pretending one is the other.
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold",
    "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  );
}
