// Live server log stream: SSE for new lines plus a one-shot tail fetch for
// history. The history is prepended (not assigned) so live lines that arrived
// while the request was in flight keep their chronological position.
import { useEffect, useState } from "react";

const MAX_LINES = 800;

export function useLogStream(server: string): {
  lines: string[];
  status: string;
} {
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState("connecting…");

  useEffect(() => {
    let cancelled = false;
    const es = new EventSource(`/api/logs/${server}/stream`);
    es.addEventListener("log", (ev) => {
      if (cancelled) return;
      const line = JSON.parse((ev as MessageEvent).data) as string;
      setLines((prev) => [...prev, line].slice(-MAX_LINES));
      setStatus("live");
    });
    es.addEventListener("end", () => {
      es.close();
      setStatus("stream closed");
    });
    es.addEventListener("error", (event) => {
      // Server error events are terminal; network errors may reconnect.
      if (event instanceof MessageEvent) es.close();
      setStatus("stream error");
    });
    fetch(`/api/logs/${server}/tail?tail=300`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        setLines((prev) => [...text.split("\n"), ...prev].slice(-MAX_LINES));
        setStatus("history loaded");
      })
      .catch(() => {
        if (!cancelled) setStatus("history unavailable (live only)");
      });
    return () => {
      cancelled = true;
      es.close();
    };
  }, [server]);

  return { lines, status };
}
