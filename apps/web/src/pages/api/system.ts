import type { APIRoute } from "astro";
import { getSystemInfo } from "../../lib/system.js";
import { json, apiError, guardAuth } from "../../lib/api.js";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const denied = guardAuth(context);
  if (denied) return denied;
  try {
    return json(await getSystemInfo());
  } catch (err) {
    return apiError(
      `Failed to get system info: ${(err as Error).message}`,
      500,
    );
  }
};
