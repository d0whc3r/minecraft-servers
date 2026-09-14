// Summary tiles above the server list: totals, live player sparkline.
import type { ReactNode } from "react";
import { cn } from "@/components/ui";

export function Stat({
  value,
  label,
  detail,
  spark,
  tone = "neutral",
}: {
  value: string;
  label: string;
  detail: string;
  spark?: ReactNode;
  tone?: "ok" | "bad" | "neutral";
}) {
  return (
    <div className="relative flex min-h-32 flex-col justify-center gap-1 px-5 py-5">
      <span className="text-[0.78rem] font-semibold text-dim">{label}</span>
      <span
        className={cn(
          "font-mono text-[2rem] leading-none font-semibold tracking-[-0.04em]",
          tone === "ok" && "text-ok",
          tone === "bad" && "text-bad",
        )}
      >
        {value}
      </span>
      <span className="mt-1 text-[0.75rem] text-dim">{detail}</span>
      {spark}
    </div>
  );
}

/** Tiny inline polyline of recent player counts, anchored in the tile corner. */
export function Sparkline({ data }: { data: number[] }) {
  const w = 120;
  const h = 28;
  const max = Math.max(1, ...data);
  const points = data
    .map(
      (v, i) =>
        `${(i / Math.max(1, data.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`,
    )
    .join(" ");
  return (
    <svg
      className="absolute right-3.5 bottom-3.5 h-[26px] w-[110px] text-ok opacity-80 max-sm:hidden"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
