// Shared text helpers: the mono constant and click-to-copy values.
import { useState } from "react";
import { cn } from "@/components/ui/cn.js";

export const MONO = "font-mono text-[0.92em]";

/** Mono value with a click-to-copy affordance (routable addresses, ports…). */
export function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy to clipboard"
      className={cn(
        "inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent p-0 font-mono text-[0.82rem] font-semibold text-ink",
        copied ? "text-ok" : "hover:text-ok",
      )}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable (non-secure context) */
        }
      }}
    >
      <span className="block max-w-64 overflow-hidden text-ellipsis whitespace-nowrap">
        {value}
      </span>
      <span
        aria-hidden="true"
        className="grid size-5 flex-none place-items-center rounded bg-raise text-[0.7rem]"
      >
        {copied ? "✓" : "⧉"}
      </span>
      <span className="sr-only">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
