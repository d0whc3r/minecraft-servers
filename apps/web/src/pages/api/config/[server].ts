import type { APIRoute } from "astro";
import { getServerDef, maskSecrets } from "../../../lib/servers.js";
import { json, apiError, guardAuth, getServerParam } from "../../../lib/api.js";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const denied = guardAuth(context);
  if (denied) return denied;
  const server = getServerParam(context);
  if (!server) return apiError("Unknown server", 404);

  const def = getServerDef(server)!;
  return json({
    server,
    title: def.title,
    platform: def.platform,
    mcVersion: def.mcVersion,
    memory: def.memory,
    type: def.type,
    connect: def.connect,
    rconPort: def.rconPort,
    maxPlayers: def.maxPlayers,
    description: def.description,
    env: maskSecrets(def.env),
  });
};
