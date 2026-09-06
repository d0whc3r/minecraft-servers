// Download a backup file (validated against path traversal).
// Kubernetes runtime: streamed with kubectl exec from the running server pod.
import fs from "node:fs";
import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import type { APIRoute } from "astro";
import { resolveBackupFile } from "@/lib/backups.js";
import { isKubernetes } from "@/lib/runtime.js";
import { spawnBackupDownload } from "@/lib/k8s.js";
import { apiError, guardAuth, getServerParam } from "@/lib/api.js";

export const prerender = false;

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const GET: APIRoute = async (context) => {
  const denied = guardAuth(context);
  if (denied) return denied;
  const server = getServerParam(context);
  if (!server) return apiError("Unknown server", 404);

  const name = context.url.searchParams.get("name") ?? "";
  if (isKubernetes()) {
    if (!SAFE_NAME.test(name) || name.includes(".."))
      return apiError("File not found", 404);
    const target = spawnBackupDownload(server, name);
    if (!target) return apiError("Invalid backup file", 400);
    const proc = spawn(target.cmd, target.args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        proc.stdout?.on("data", (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        proc.stderr?.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          if (/error|not found|no such/i.test(text)) {
            controller.error(new Error(text.trim()));
          }
        });
        proc.on("error", (err) => controller.error(err));
        proc.on("close", (code) => {
          if (code === 0) controller.close();
          else
            controller.error(
              new Error(
                `kubectl exec exited with code ${code} (is the server running?)`,
              ),
            );
        });
        context.request.signal.addEventListener("abort", () =>
          proc.kill("SIGTERM"),
        );
      },
      cancel() {
        proc.kill("SIGTERM");
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "application/gzip",
        "content-disposition": `attachment; filename="${name}"`,
        "cache-control": "no-store",
      },
    });
  }

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
