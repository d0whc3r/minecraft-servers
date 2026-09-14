// RCON console: command history (↑/↓), quick commands and the output pane.
import { useEffect, useRef, useState } from "react";
import type { ServerStatus } from "@/types";
import { api } from "@/lib/client";
import type { ToastPush } from "@/components/ui";
import {
  Button,
  buttonClass,
  cn,
  inputClass,
  Modal,
  MONO,
} from "@/components/ui";

const HISTORY_LIMIT = 50;

export function RconModal({
  server,
  onClose,
  push,
}: {
  server: ServerStatus;
  onClose: () => void;
  push: ToastPush;
}) {
  const [cmd, setCmd] = useState("");
  const [history, setHistory] = useState<
    Array<{ cmd: string; out: string; ok: boolean }>
  >([]);
  const [sending, setSending] = useState(false);
  const histIdx = useRef(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = async (command: string) => {
    if (!command.trim() || sending) return;
    setSending(true);
    try {
      const res = await api<{ ok: boolean; output: string }>(
        `/api/rcon/${server.name}`,
        { method: "POST", json: { command } },
      );
      setHistory((h) => [
        ...h.slice(-HISTORY_LIMIT),
        { cmd: command, out: res.output, ok: res.ok },
      ]);
    } catch (err) {
      setHistory((h) => [
        ...h.slice(-HISTORY_LIMIT),
        { cmd: command, out: (err as Error).message, ok: false },
      ]);
    } finally {
      setSending(false);
      setCmd("");
      histIdx.current = -1;
    }
  };

  const quick =
    server.state === "running"
      ? ["list", "tps", "save-all", "whitelist list", "banlist"]
      : [];

  return (
    <Modal
      title={
        <>
          RCON console · <span className={MONO}>{server.name}</span>
        </>
      }
      onClose={onClose}
      wide
    >
      <pre className="h-[min(50dvh,480px)] overflow-auto rounded-lg border border-edge bg-[#0b1017] px-3 py-3 font-mono text-[0.76rem] leading-relaxed break-words whitespace-pre-wrap text-ink">
        {history.length === 0
          ? "Type a command and press Enter. No leading slash (e.g. list)\n"
          : history.flatMap((h) => [`> ${h.cmd}`, h.out, ""]).join("\n")}
      </pre>
      <form
        className="my-2.5 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(cmd);
        }}
      >
        <span className="font-mono font-bold text-ok">&gt;</span>
        <input
          ref={inputRef}
          name="rcon-command"
          autoComplete="off"
          spellCheck={false}
          className={cn(inputClass, "flex-1 font-mono")}
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" && history.length) {
              e.preventDefault();
              histIdx.current =
                histIdx.current < 0
                  ? history.length - 1
                  : Math.max(0, histIdx.current - 1);
              setCmd(history[histIdx.current].cmd);
            }
            if (e.key === "ArrowDown" && histIdx.current >= 0) {
              e.preventDefault();
              histIdx.current =
                histIdx.current + 1 >= history.length
                  ? -1
                  : histIdx.current + 1;
              setCmd(histIdx.current >= 0 ? history[histIdx.current].cmd : "");
            }
          }}
          placeholder={
            server.state === "running" ? "list" : "server is stopped"
          }
          aria-label="RCON command"
          disabled={server.state !== "running"}
        />
        <Button
          variant="primary"
          type="submit"
          disabled={sending || server.state !== "running"}
        >
          Send
        </Button>
      </form>
      {quick.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              className={buttonClass(
                "default",
                "sm",
                "cursor-pointer rounded-full font-mono",
              )}
              onClick={() => void send(q)}
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
