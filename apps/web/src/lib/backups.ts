// Backup file helpers shared by the backup API routes.
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "./servers.js";

export function backupDirFor(server: string): string {
  return path.join(PROJECT_ROOT, "backups", server);
}

/** Resolves backups/<server>/<name> safely; null when the name is untrustworthy. */
export function resolveBackupFile(server: string, name: string): string | null {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) || name.includes(".."))
    return null;
  const full = path.join(backupDirFor(server), name);
  try {
    if (!fs.statSync(full).isFile()) return null;
  } catch {
    return null;
  }
  return full;
}
