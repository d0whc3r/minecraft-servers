// Server-state indicators: dot, badge and the top card bar.
import { cn } from "@/components/ui/cn.js";

export const STATE_LABELS: Record<string, string> = {
  running: "Running",
  stopped: "Stopped",
  unhealthy: "Unhealthy",
  starting: "Starting",
  missing: "No container",
};

const DOT_COLORS: Record<string, string> = {
  running: "bg-ok",
  starting: "bg-warn",
  unhealthy: "bg-bad",
  stopped: "bg-idle",
  missing: "bg-idle opacity-50",
};

export function StatusDot({ state }: { state: string }) {
  const pinging = state === "starting" || state === "unhealthy";
  return (
    <span
      className="relative inline-block size-2.5 flex-none"
      aria-hidden="true"
    >
      {pinging && (
        <span
          className={cn(
            "absolute inset-0 animate-ping rounded-full motion-reduce:animate-none",
            DOT_COLORS[state],
          )}
        />
      )}
      <span
        className={cn("absolute inset-0 rounded-full", DOT_COLORS[state])}
      />
    </span>
  );
}

export function StateBadge({ state }: { state: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-edge2 bg-base/55 px-2.5 py-1 text-[0.74rem] font-semibold text-dim">
      <StatusDot state={state} />
      <span>{STATE_LABELS[state] ?? state}</span>
    </span>
  );
}

/** Top status line on server cards, coloured by state. */
export function StateBar({ state }: { state: string }) {
  const colors: Record<string, string> = {
    running: "bg-ok",
    starting: "bg-warn",
    unhealthy: "bg-bad",
    stopped: "bg-idle",
    missing: "bg-idle",
  };
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute inset-x-0 top-0 h-0.5",
        colors[state] ?? "bg-idle",
      )}
    />
  );
}
