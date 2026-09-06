import type { APIRoute } from "astro";
import { createServer, SERVER_TYPES } from "@/lib/serverCreate.js";
import { json, apiError, guardAuth, guardCsrf } from "@/lib/api.js";

export const prerender = false;

/**
 * Create a new server live: writes its env config to the runtime's writable
 * dir (repo catalog on docker, panel data dir on kubernetes) so it persists
 * and joins the registry on the next poll. Starting it is a separate action.
 */
export const POST: APIRoute = async (context) => {
  const denied = guardAuth(context);
  if (denied) return denied;
  const csrf = guardCsrf(context);
  if (csrf) return csrf;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  try {
    const result = createServer(body);
    return json(
      {
        ok: true,
        name: result.name,
        rconPort: result.rconPort,
        file: result.file,
        connect: result.def.connect,
      },
      201,
    );
  } catch (err) {
    return apiError((err as Error).message, 400);
  }
};

/** Type catalog for the create form (labels + defaults, no server internals). */
export const GET: APIRoute = async (context) => {
  const denied = guardAuth(context);
  if (denied) return denied;
  return json({
    types: Object.entries(SERVER_TYPES).map(([id, spec]) => ({
      id,
      label: spec.label,
      defaultVersion: spec.defaultVersion,
      modpackRequired: spec.modpackRequired ?? false,
    })),
  });
};
