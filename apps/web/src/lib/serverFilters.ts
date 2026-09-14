// Shared server filtering used by both the public dashboard and the admin
// servers table: state categories, free-text search and per-filter counts.
import type { ServerStatus } from "@/types.js";

export type ServerStateFilter = "all" | "running" | "stopped" | "alerts";

export const STATE_FILTER_OPTIONS: Array<[ServerStateFilter, string]> = [
  ["all", "All"],
  ["running", "Running"],
  ["stopped", "Stopped"],
  ["alerts", "Alerts"],
];

export function matchesStateFilter(
  server: ServerStatus,
  filter: ServerStateFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "running":
      return server.state === "running" || server.state === "starting";
    case "stopped":
      return server.state === "stopped" || server.state === "missing";
    case "alerts":
      return server.state === "unhealthy";
  }
}

export function stateFilterCounts(
  servers: ServerStatus[],
): Record<ServerStateFilter, number> {
  return {
    all: servers.length,
    running: servers.filter((s) => matchesStateFilter(s, "running")).length,
    stopped: servers.filter((s) => matchesStateFilter(s, "stopped")).length,
    alerts: servers.filter((s) => matchesStateFilter(s, "alerts")).length,
  };
}

/** Case-insensitive match across the searchable server fields. */
export function matchesServerQuery(
  server: ServerStatus,
  rawQuery: string,
): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  return [
    server.name,
    server.title,
    server.platform,
    server.mcVersion,
    server.description,
    ...server.tags,
  ].some((value) => value.toLowerCase().includes(q));
}
