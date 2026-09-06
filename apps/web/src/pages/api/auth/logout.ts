import type { APIRoute } from "astro";
import { sessionCookieName, isPublicView } from "@/lib/auth.js";
import { json } from "@/lib/api.js";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  context.cookies.delete(sessionCookieName, { path: "/" });
  return json({ ok: true, publicView: isPublicView() });
};
