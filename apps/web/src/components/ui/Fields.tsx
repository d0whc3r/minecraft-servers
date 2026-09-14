// Form fields and filter controls: labels, the shared input class, the search
// box and the counted segmented filter group.
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn.js";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-[0.85rem] text-dim">
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  );
}

/** Label/value group for read-only details; unlike Field, emits no form label. */
export function InfoField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 text-[0.85rem] text-dim">
      <span className="font-semibold">{label}</span>
      {children}
    </div>
  );
}

export const inputClass =
  "min-h-10 rounded-lg border border-edge bg-base/65 px-3 py-2 font-sans text-ink placeholder:text-dim/75 transition-colors hover:border-[#45594f] focus:border-ok";

export function FilterSearch({
  value,
  onChange,
  placeholder,
  label,
  name,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  name: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-[min(300px,100%)] flex-1", className)}>
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 fill-none stroke-dim stroke-2"
      >
        <circle cx="8.5" cy="8.5" r="5.5" />
        <path d="m12.5 12.5 4 4" />
      </svg>
      <input
        type="search"
        name={name}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className={cn(inputClass, "w-full pl-9")}
      />
    </div>
  );
}

export function CountedFilterGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; count: number }>;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            className={cn(
              "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border-0 px-3 font-sans text-[0.82rem] font-semibold text-dim",
              active ? "bg-raise text-ink" : "bg-transparent hover:text-ink",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 font-mono text-[0.7rem]",
                active ? "bg-ok/12 text-ok" : "bg-raise text-dim",
              )}
            >
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
