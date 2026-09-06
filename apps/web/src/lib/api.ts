// Shared helpers for the Astro API routes: JSON responses, auth guard, CSRF.
import type { APIRoute } from "astro";
import { verifySessionToken, sessionCookieName, isPublicView } from "@/lib/auth.js";
import { getServerDef } from "@/lib/servers.js";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function apiError(message: string, status = 400): Response {
  return json({ error: message }, status);
}

/** Returns null when allowed; a Response to reject with otherwise. */
export function guardAuth(
  context: Parameters<APIRoute>[0],
  opts: { admin?: boolean } = {},
): Response | null {
  const { admin = true } = opts;
  const token = context.cookies.get(sessionCookieName)?.value;
  const authed = verifySessionToken(token);
  if (admin) {
    return authed ? null : apiError("Not authenticated", 401);
  }
  // public read access
  if (authed || isPublicView()) return null;
  return apiError("Not authenticated", 401);
}

/** Cheap CSRF defense: state-changing calls must carry this custom header. */
export function guardCsrf(context: Parameters<APIRoute>[0]): Response | null {
  if (context.request.headers.get("x-mcpanel") === "1") return null;
  return apiError("Request rejected", 403);
}

export function getServerParam(
  context: Parameters<APIRoute>[0],
): string | null {
  const name = context.params.server;
  if (!name || !/^[a-z0-9-]+$/.test(name)) return null;
  if (!getServerDef(name)) return null;
  return name;
}

/**
 * Client IP for login throttling. `X-Forwarded-For` is attacker-controlled
 * unless the panel sits behind a proxy we trust, so it is only honored when
 * MCPANEL_TRUST_PROXY=true; otherwise the socket address is used and spoofed
 * headers cannot rotate the rate-limit bucket.
 */
export function clientIp(context: Parameters<APIRoute>[0]): string {
  if (process.env.MCPANEL_TRUST_PROXY === "true") {
    const forwarded = context.request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      .trim();
    if (forwarded) return forwarded;
  }
  return context.clientAddress || "unknown";
}
