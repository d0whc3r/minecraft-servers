// Backup listing for a server (backups/<server>/*.tar.gz + checksums).
// Kubernetes runtime: the mc-<server>-backups claim is listed in-cluster.
import path from "node:path";
import fsp from "node:fs/promises";
import type { APIRoute } from "astro";
import { PROJECT_ROOT } from "@/lib/servers.js";
import { backupDirFor } from "@/lib/backups.js";
import { isKubernetes } from "@/lib/runtime.js";
import { listBackups } from "@/lib/k8s.js";
import {
  json,
  apiError,
  guardAuth,
  getServerParam,
} from "@/lib/api.js";
import type { BackupFile } from "@/types.js";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const denied = guardAuth(context);
  if (denied) return denied;
  const server = getServerParam(context);
  if (!server) return apiError("Unknown server", 404);

  if (isKubernetes()) {
    try {
      const files = await listBackups(server);
      return json({
        server,
        dir: `mc-${server}-backups`,
        files,
      });
    } catch (err) {
      return apiError(
        `No se pudieron listar los backups: ${(err as Error).message}`,
        500,
      );
    }
  }

  const dir = backupDirFor(server);
  const files: BackupFile[] = [];
  try {
    const entries = await fsp.readdir(dir);
    const checksums = new Set(entries.filter((f) => f.endsWith(".sha256")));
    for (const entry of entries) {
      if (!entry.endsWith(".tar.gz")) continue;
      const full = path.join(dir, entry);
      const stat = await fsp.stat(full);
      files.push({
        file: entry,
        sizeBytes: stat.size,
        modified: stat.mtime.toISOString(),
        hasChecksum: checksums.has(`${entry}.sha256`),
      });
    }
  } catch {
    // no backups yet
  }
  files.sort((a, b) => b.modified.localeCompare(a.modified));
  return json({ server, dir: path.relative(PROJECT_ROOT, dir), files });
};
