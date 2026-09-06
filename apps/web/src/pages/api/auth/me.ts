import type { APIRoute } from "astro";
import {
  verifySessionToken,
  sessionCookieName,
  isPublicView,
} from "@/lib/auth.js";
import { json } from "@/lib/api.js";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const authed = verifySessionToken(
    context.cookies.get(sessionCookieName)?.value,
  );
  return json({
    authed,
    user: authed ? "admin" : null,
    publicView: isPublicView(),
  });
};
