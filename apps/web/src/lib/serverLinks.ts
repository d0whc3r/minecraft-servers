// Cross-view link helpers (dashboard ↔ admin deep links).
/** Admin URL for one server: highlights and scrolls to its table row. */
export function adminServerHref(name: string): string {
  const encodedName = encodeURIComponent(name);
  return `/admin?server=${encodedName}#admin-server-${encodedName}`;
}

/** DOM id of a server's row in the admin table (see DataTable getRowAnchor). */
export function adminServerAnchor(name: string): string {
  return `admin-server-${name}`;
}
