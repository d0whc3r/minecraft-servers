// Modal: focus-trapped dialog with escape/backdrop dismissal.
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { cn } from "@/components/ui/cn.js";
import { Button } from "@/components/ui/Button.js";

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
          "flex max-h-[min(88dvh,900px)] w-full flex-col overflow-hidden rounded-2xl border border-edge bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.6)]",
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
        <div className="overscroll-contain overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
