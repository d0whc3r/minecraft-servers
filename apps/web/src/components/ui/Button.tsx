// Buttons: variants, sizes and the class helper for link-styled buttons.
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/components/ui/cn.js";

export type ButtonVariant = "default" | "primary" | "danger" | "ghost";
export type ButtonSize = "md" | "sm" | "icon";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default:
    "border-edge bg-raise text-ink hover:border-[#45594f] hover:bg-[#223029]",
  primary:
    "border-transparent bg-ok font-semibold text-[#07100b] hover:bg-[#82e7b1]",
  danger:
    "border-transparent bg-bad font-semibold text-[#1b0d0b] hover:bg-[#f58c7f]",
  ghost: "border-edge bg-transparent text-ink hover:bg-raise",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "px-3.5 py-2 text-sm",
  sm: "px-2.5 py-1.5 text-[0.82rem]",
  icon: "px-2 py-1 text-[0.85rem]",
};

const BUTTON_BASE =
  "inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border font-sans font-semibold transition-[background-color,border-color,color] disabled:cursor-not-allowed disabled:opacity-45";

export function buttonClass(
  variant: ButtonVariant = "default",
  size: ButtonSize = "md",
  extra?: string,
): string {
  return cn(BUTTON_BASE, VARIANT_CLASSES[variant], SIZE_CLASSES[size], extra);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "default",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      {...rest}
    />
  );
}
