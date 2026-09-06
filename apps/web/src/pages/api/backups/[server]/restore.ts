import type { APIRoute } from "astro";
import { runAction, isActionRunning } from "../../../../lib/actions.js";
import { resolveBackupFile } from "../../../../lib/backups.js";
import {
  json,
  apiError,
  guardAuth,
  guardCsrf,
  getServerParam,
} from "../../../../lib/api.js";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const denied = guardAuth(context);
  if (denied) return denied;
  const csrf = guardCsrf(context);
  if (csrf) return csrf;

  const server = getServerParam(context);
  if (!server) return apiError("Unknown server", 404);

  let body: { file?: string };
  try {
    body = (await context.request.json()) as { file?: string };
  } catch {
    return apiError("Invalid request body", 400);
  }
  const file = body.file ?? "";
  if (!resolveBackupFile(server, file)) {
    return apiError("Invalid backup file", 404);
  }
  if (isActionRunning(server)) {
    return apiError("Another action is already running for this server", 409);
  }

  try {
    const result = await runAction("restore", server, file);
    return json(result);
  } catch (err) {
    return json(
      {
        ok: false,
        action: "restore",
        server,
        output: (err as Error).message,
        durationMs: 0,
      },
      500,
    );
  }
};
