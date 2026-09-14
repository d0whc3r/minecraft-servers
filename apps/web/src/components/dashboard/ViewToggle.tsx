// Cards/table view switcher, persisted by the parent in localStorage.
import { cn } from "@/components/ui";

export type DashboardView = "cards" | "table";

export function ViewToggle({
  view,
  onChange,
}: {
  view: DashboardView;
  onChange: (view: DashboardView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="View mode"
      className="inline-flex rounded-xl border border-edge bg-panel p-1"
    >
      {(["cards", "table"] as DashboardView[]).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          className={cn(
            "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border-0 px-2.5 font-sans text-[0.8rem] font-semibold text-dim",
            view === v ? "bg-raise text-ink" : "bg-transparent hover:text-ink",
          )}
          onClick={() => onChange(v)}
        >
          <ViewIcon view={v} />
          <span className="max-sm:sr-only">
            {v === "cards" ? "Cards" : "Table"}
          </span>
        </button>
      ))}
    </div>
  );
}

function ViewIcon({ view }: { view: DashboardView }) {
  return view === "cards" ? (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5 fill-current"
      aria-hidden="true"
    >
      <path d="M1 1h6v6H1zm8 0h6v6H9zM1 9h6v6H1zm8 0h6v6H9z" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5 fill-current"
      aria-hidden="true"
    >
      <path d="M1 2h14v3H1zm0 4.5h14v3H1zM1 11h14v3H1z" />
    </svg>
  );
}
