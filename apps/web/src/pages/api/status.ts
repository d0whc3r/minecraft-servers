import type { APIRoute } from "astro";
import { buildStatus } from "@/lib/status.js";
import { json, apiError, guardAuth } from "@/lib/api.js";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const denied = guardAuth(context, { admin: false });
  if (denied) return denied;
  try {
    return json(await buildStatus());
  } catch (err) {
    return apiError(`Failed to get status: ${(err as Error).message}`, 500);
  }
};
