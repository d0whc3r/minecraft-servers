// Reusable UI kit for the panel: buttons, chips, dots, meters, modals, toasts.
// Styling is Tailwind; tokens live in src/styles/global.css (@theme).
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

/** Joins class names, skipping falsy values. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ---- Buttons -----------------------------------------------------------------

type ButtonVariant = "default" | "primary" | "danger" | "ghost";
type ButtonSize = "md" | "sm" | "icon";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default: "border-edge bg-raise text-ink hover:bg-[#243044]",
  primary:
    "border-transparent bg-ok font-semibold text-[#0c130c] hover:bg-[#4fc782]",
  danger:
    "border-transparent bg-bad font-semibold text-[#1b0d0b] hover:bg-[#f07c6d]",
  ghost: "border-edge bg-transparent text-ink hover:bg-raise",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "px-3.5 py-2 text-sm",
  sm: "px-2.5 py-1.5 text-[0.82rem]",
  icon: "px-2 py-1 text-[0.85rem]",
};

const BUTTON_BASE =
  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border font-sans transition-colors disabled:cursor-not-allowed disabled:opacity-45";

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

// ---- Status -------------------------------------------------------------------

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
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[0.85rem] text-dim">
      <StatusDot state={state} />
      <span>{STATE_LABELS[state] ?? state}</span>
    </span>
  );
}

/** Left edge bar on server cards, colored by state. */
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
        "absolute inset-y-0 left-0 w-1",
        colors[state] ?? "bg-idle",
      )}
    />
  );
}

// ---- Chips ----------------------------------------------------------------------

export function Chip({
  children,
  tone,
  onClick,
}: {
  children: ReactNode;
  tone?: "mono" | "button";
  onClick?: () => void;
}) {
  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border border-edge bg-raise px-2.5 py-0.5 text-[0.8rem] text-ink",
        tone === "mono" && "font-mono",
        tone === "button" && "cursor-pointer font-mono hover:bg-[#243044]",
      )}
    >
      {children}
    </span>
  );
}

// ---- Meter ---------------------------------------------------------------------

export function Meter({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / Math.max(1, max)) * 100);
  return (
    <div className="h-[5px] overflow-hidden rounded-[3px] bg-raise">
      <div
        className="h-full rounded-[3px] bg-ok transition-[width] duration-400"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ---- Modal -----------------------------------------------------------------------

export function Modal({
  title,
  onClose,
  children,
  wide,
  dismissible = true,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  dismissible?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeOnEscape = useEffectEvent(() => {
    if (dismissible) onClose();
  });

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const focusableElements = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]",
        ),
      ).filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(":disabled") &&
          element.getClientRects().length > 0,
      );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeOnEscape();
      }
      if (e.key !== "Tab") return;
      const elements = focusableElements();
      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;
      if (!first) {
        e.preventDefault();
        dialog.focus();
      } else if (!dialog.contains(active) || active === dialog) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    (focusableElements()[0] ?? dialog).focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#05080c]/70 p-4"
      onMouseDown={(e) =>
        dismissible && e.target === e.currentTarget && onClose()
      }
    >
      <div
        className={cn(
          "flex max-h-[min(85dvh,900px)] w-full flex-col overflow-hidden rounded-2xl border border-edge bg-panel shadow-[0_18px_60px_rgba(0,0,0,0.5)]",
          wide ? "max-w-[860px]" : "max-w-[560px]",
        )}
        role="dialog"
        ref={dialogRef}
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="flex items-center justify-between gap-4 border-b border-edge2 px-4 py-3.5">
          <h2 id={titleId} className="m-0 text-[1.05rem] font-semibold">
            {title}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={!dismissible}
            aria-label="Close"
          >
            ✕
          </Button>
        </header>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

// ---- Form fields --------------------------------------------------------------------

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

export const inputClass =
  "rounded-lg border border-edge bg-raise px-3 py-2 font-sans text-ink placeholder:text-dim";

// ---- Toasts -----------------------------------------------------------------------

export interface ToastMsg {
  id: number;
  kind: "ok" | "err" | "info";
  text: string;
  detail?: string;
}

let toastSeq = 1;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  // Stable identity: consumers put `push` in effect/memo deps.
  const push = useCallback(
    (kind: ToastMsg["kind"], text: string, detail?: string) => {
      const id = toastSeq++;
      setToasts((t) => [...t, { id, kind, text, detail }]);
      setTimeout(
        () => setToasts((t) => t.filter((x) => x.id !== id)),
        kind === "err" ? 10000 : 5000,
      );
    },
    [],
  );
  const list = (
    <div
      className="fixed right-4 bottom-4 z-60 flex max-w-[min(420px,calc(100vw-2rem))] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
          className={cn(
            "cursor-pointer rounded-lg border border-l-4 border-edge bg-raise px-3 py-2 text-[0.88rem] shadow-[0_6px_24px_rgba(0,0,0,0.35)]",
            t.kind === "ok" && "border-l-ok",
            t.kind === "err" && "border-l-bad",
            t.kind === "info" && "border-l-warn",
          )}
        >
          <strong>{t.text}</strong>
          {t.detail && (
            <pre className="mt-1.5 max-h-45 overflow-auto font-mono text-[0.75rem] break-words whitespace-pre-wrap text-dim">
              {t.detail}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
  return { push, list };
}

// ---- Shared text helpers --------------------------------------------------------------

export const MONO = "font-mono text-[0.92em]";

/** Mono value with a click-to-copy affordance (routable addresses, ports…). */
export function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy to clipboard"
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent p-0 font-mono text-[0.92em] text-ink",
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
      <span aria-hidden="true">{copied ? "✓" : "⧉"}</span>
      <span className="sr-only">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
