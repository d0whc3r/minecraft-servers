// Chip: small rounded tag, static or clickable.
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn.js";

export function Chip({
  children,
  tone,
  onClick,
}: {
  children: ReactNode;
  tone?: "mono" | "button";
  onClick?: () => void;
}) {
  const className = cn(
    "inline-flex items-center rounded-full border border-edge bg-raise px-2.5 py-0.5 text-[0.8rem] text-ink",
    tone === "mono" && "font-mono",
    tone === "button" && "cursor-pointer font-mono hover:bg-[#223029]",
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ) : (
    <span className={className}>{children}</span>
  );
}
