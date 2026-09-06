import type { APIRoute } from "astro";
import { deleteServer } from "@/lib/serverCreate.js";
import {
  json,
  apiError,
  guardAuth,
  guardCsrf,
  getServerParam,
} from "@/lib/api.js";
import { backend } from "@/lib/backend.js";
import {
  ServerOperationConflict,
  withServerOperation,
} from "@/lib/serverOperations.js";

export const prerender = false;

/**
 * Remove a panel-created server from the registry (its env config file).
 * Repo catalog servers are rejected, and a running server must be stopped
 * first. World data and backups on disk are never touched.
 */
export const DELETE: APIRoute = async (context) => {
  const denied = guardAuth(context);
  if (denied) return denied;
  const csrf = guardCsrf(context);
  if (csrf) return csrf;

  const server = getServerParam(context);
  if (!server) return apiError("Unknown server", 404);

  try {
    return await withServerOperation(server, async () => {
      let stopped: boolean;
      try {
        stopped = await backend.isServerStopped(server);
      } catch {
        return apiError(
          "Cannot verify server state; try removing it again later",
          503,
        );
      }
      if (!stopped) return apiError("Stop the server before removing it", 409);
      const { file } = deleteServer(server);
      return json({ ok: true, server, file });
    });
  } catch (err) {
    if (err instanceof ServerOperationConflict)
      return apiError(err.message, 409);
    return apiError((err as Error).message, 400);
  }
};
