import type { APIRoute } from "astro";
import { rconCommand } from "@/lib/rcon.js";
import { getServerDef, rconPassword } from "@/lib/servers.js";
import {
  json,
  apiError,
  guardAuth,
  guardCsrf,
  getServerParam,
} from "@/lib/api.js";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const denied = guardAuth(context);
  if (denied) return denied;
  const csrf = guardCsrf(context);
  if (csrf) return csrf;

  const server = getServerParam(context);
  if (!server) return apiError("Unknown server", 404);

  let body: { command?: string };
  try {
    body = (await context.request.json()) as { command?: string };
  } catch {
    return apiError("Invalid request body", 400);
  }
  const command = (body.command ?? "").trim().slice(0, 500);
  if (!command) return apiError("Empty command", 400);
  if (command.startsWith("/")) {
    // RCON expects commands without the leading slash
    return apiError("Drop the leading slash (e.g. list)", 400);
  }

  const def = getServerDef(server)!;
  const password = rconPassword(def);
  if (!def.rconPort || !password) {
    return apiError("RCON is not configured for this server", 409);
  }

  const result = await rconCommand(
    def.rconHost,
    def.rconPort,
    password,
    command,
  );
  return json(result, result.ok ? 200 : 502);
};
