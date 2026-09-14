// Polls /api/status on an interval while the tab is visible; exposes the last
// snapshot and the latest connection error.
import { useEffect, useRef, useState } from "react";
import type { StatusResponse } from "@/types";
import { api, startPolling } from "@/lib/client";

export function useStatusPolling(
  intervalMs = 5000,
  onData?: (data: StatusResponse) => void,
): { status: StatusResponse | null; error: string | null } {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Latest callback without re-arming the polling effect on every render.
  const onDataRef = useRef(onData);
  onDataRef.current = onData;

  useEffect(() => {
    return startPolling(async () => {
      try {
        const data = await api<StatusResponse>("/api/status");
        setStatus(data);
        setError(null);
        onDataRef.current?.(data);
      } catch (err) {
        setError((err as Error).message);
      }
    }, intervalMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { status, error };
}
