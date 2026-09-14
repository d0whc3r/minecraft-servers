// Live log viewer: SSE stream + tail history, text filter and follow toggle.
import { useEffect, useRef, useState } from "react";
import { cn, inputClass, Modal, MONO } from "@/components/ui";
import { useLogStream } from "@/hooks/useLogStream";

export function LogsModal({
  server,
  onClose,
}: {
  server: string;
  onClose: () => void;
}) {
  const { lines, status } = useLogStream(server);
  const [filter, setFilter] = useState("");
  const [follow, setFollow] = useState(true);
  const boxRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (follow && boxRef.current)
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [lines, follow]);

  const visible = filter
    ? lines.filter((l) => l.toLowerCase().includes(filter.toLowerCase()))
    : lines;

  return (
    <Modal
      title={
        <>
          Logs · <span className={MONO}>{server}</span>
        </>
      }
      onClose={onClose}
      wide
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="log-filter"
          autoComplete="off"
          className={cn(inputClass, "min-w-45 flex-1")}
          placeholder="Filter lines…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter logs"
        />
        <label className="inline-flex items-center gap-1.5 text-[0.88rem] text-dim">
          <input
            name="follow-logs"
            type="checkbox"
            checked={follow}
            onChange={(e) => setFollow(e.target.checked)}
          />
          Follow live
        </label>
        <span className="text-sm text-dim">
          {status} · {visible.length} lines
        </span>
      </div>
      <pre
        ref={boxRef}
        className="h-[min(50dvh,480px)] overflow-auto rounded-lg border border-edge bg-[#0b1017] px-3 py-3 font-mono text-[0.76rem] leading-relaxed break-words whitespace-pre-wrap text-ink"
      >
        {visible.join("\n") || "No lines to show."}
      </pre>
    </Modal>
  );
}
