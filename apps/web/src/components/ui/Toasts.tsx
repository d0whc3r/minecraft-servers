// Toasts: transient notifications with a list container and push hook.
import { useCallback, useState } from "react";
import { cn } from "@/components/ui/cn.js";

export interface ToastMsg {
  id: number;
  kind: "ok" | "err" | "info";
  text: string;
  detail?: string;
}

/** Push function shape, usable in props without importing the hook's return. */
export type ToastPush = ReturnType<typeof useToasts>["push"];

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
    <div className="fixed right-4 bottom-4 z-60 flex max-w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-start gap-3 rounded-lg border border-l-4 border-edge bg-raise px-3 py-2 text-[0.88rem] shadow-[0_6px_24px_rgba(0,0,0,0.35)]",
            t.kind === "ok" && "border-l-ok",
            t.kind === "err" && "border-l-bad",
            t.kind === "info" && "border-l-warn",
          )}
          role={t.kind === "err" ? "alert" : "status"}
        >
          <div className="min-w-0 flex-1">
            <strong>{t.text}</strong>
            {t.detail && (
              <pre className="mt-1.5 max-h-45 overflow-auto font-mono text-[0.75rem] break-words whitespace-pre-wrap text-dim">
                {t.detail}
              </pre>
            )}
          </div>
          <button
            type="button"
            aria-label={`Dismiss notification: ${t.text}`}
            className="grid size-7 flex-none cursor-pointer place-items-center rounded-md border-0 bg-transparent text-dim hover:bg-panel hover:text-ink"
            onClick={() =>
              setToasts((all) => all.filter((item) => item.id !== t.id))
            }
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      ))}
    </div>
  );
  return { push, list };
}
