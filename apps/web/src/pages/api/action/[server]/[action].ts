import type { APIRoute } from "astro";
import { runAction, type ActionType } from "../../../../lib/actions.js";
import {
  json,
  apiError,
  guardAuth,
  guardCsrf,
  getServerParam,
} from "../../../../lib/api.js";
import { buildStatus } from "../../../../lib/status.js";

export const prerender = false;

const VALID_ACTIONS: ActionType[] = ["start", "stop", "restart", "backup"];

export const POST: APIRoute = async (context) => {
  const denied = guardAuth(context);
  if (denied) return denied;
  const csrf = guardCsrf(context);
  if (csrf) return csrf;

  const server = getServerParam(context);
  if (!server) return apiError("Unknown server", 404);

  const action = context.params.action as ActionType | undefined;
  if (!action || !VALID_ACTIONS.includes(action)) {
    return apiError(`Invalid action; use: ${VALID_ACTIONS.join(", ")}`, 400);
  }

  // Never start a server that already has its port taken by a running peer.
  if (action === "start") {
    const status = await buildStatus();
    const target = status.servers.find((s) => s.name === server);
    if (target && target.state === "running") {
      return apiError("Server is already running", 409);
    }
  }

  try {
    const result = await runAction(action, server);
    return json(result);
  } catch (err) {
    return json(
      {
        ok: false,
        action,
        server,
        output: (err as Error).message,
        durationMs: 0,
      },
      500,
    );
  }
};
