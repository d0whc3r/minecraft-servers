// Download a backup file (validated against path traversal).
import fs from "node:fs";
import { stat } from "node:fs/promises";
import type { APIRoute } from "astro";
import { resolveBackupFile } from "../../../../lib/backups.js";
import { apiError, guardAuth, getServerParam } from "../../../../lib/api.js";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const denied = guardAuth(context);
  if (denied) return denied;
  const server = getServerParam(context);
  if (!server) return apiError("Unknown server", 404);

  const name = context.url.searchParams.get("name") ?? "";
  const full = resolveBackupFile(server, name);
  if (!full) return apiError("File not found", 404);

  const info = await stat(full);
  const nodeStream = fs.createReadStream(full);
  return new Response(nodeStream as unknown as ReadableStream, {
    headers: {
      "content-type": "application/gzip",
      "content-length": String(info.size),
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
};
