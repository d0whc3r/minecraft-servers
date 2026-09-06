// Client-side helpers shared by the React islands.

export async function api<T>(
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("x-mcpanel", "1"); // CSRF marker required by mutating endpoints
  let body = init?.body;
  if (init?.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(url, {
    ...init,
    headers,
    body,
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
  return data;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function formatUptime(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec)) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(sec)}s`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} days ago`;
}

/** Polls `fn` every `ms` while the tab is visible; returns a stop function. */
export function startPolling(
  fn: () => void | Promise<void>,
  ms: number,
): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;
  const tick = () => {
    if (document.visibilityState === "visible") void fn();
  };
  void fn();
  timer = setInterval(tick, ms);
  document.addEventListener("visibilitychange", tick);
  return () => {
    if (timer) clearInterval(timer);
    document.removeEventListener("visibilitychange", tick);
  };
}
