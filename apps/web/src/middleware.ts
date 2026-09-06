// Central authorization + hardening middleware.
//
// This is the single enforcement point for access control:
//  - Public API surface is an explicit allowlist; everything else under
//    /api requires a valid session (401 otherwise).
//  - Mutating /api requests must carry the x-mcpanel header (CSRF).
//  - The dashboard page is public unless MCPANEL_PUBLIC_VIEW=false; /admin
//    renders its client-side sign-in shell for everyone, but every piece of
//    admin data lives behind the /api gate below.
//  - Hardening headers are attached to responses.
// Individual routes keep their own guardAuth/guardCsrf checks as defense in
// depth; this middleware guarantees the policy even if a new route forgets.
import type { APIContext, MiddlewareHandler } from "astro";
import {
  ensureAuthConfigured,
  isPublicView,
  sessionCookieName,
  verifySessionToken,
} from "@/lib/auth.js";

/** API endpoints reachable without a session. */
const PUBLIC_API = new Set([
  "/api/auth/login",
  "/api/auth/me",
  "/api/auth/logout",
]);

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function withHardeningHeaders(response: Response): Response {
  response.headers.set("x-frame-options", "DENY");
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "no-referrer");
  response.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.headers.set(
    "content-security-policy",
    [
      "default-src 'self'",
      // Astro hydration payloads and island bootstrapping are inline scripts.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
    ].join("; "),
  );
  return response;
}

function hasSession(context: APIContext): boolean {
  return verifySessionToken(context.cookies.get(sessionCookieName)?.value);
}

export const onRequest: MiddlewareHandler = async (context, next) => {
  // Memoized after the first call (see auth.ts): no per-request filesystem cost.
  ensureAuthConfigured();

  const { pathname } = context.url;
  const isApi = pathname.startsWith("/api/");
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(context.request.method);

  let response: Response;
  if (isApi) {
    if (
      PUBLIC_API.has(pathname) ||
      (pathname === "/api/status" && isPublicView())
    ) {
      // 1. Explicit public surface (login exempt from the CSRF marker)
      response = await next();
    } else {
      // 2. CSRF marker for mutations, 3. then a valid session
      if (mutating && context.request.headers.get("x-mcpanel") !== "1") {
        response = jsonResponse({ error: "Request rejected" }, 403);
      } else if (!hasSession(context)) {
        response = jsonResponse({ error: "Not authenticated" }, 401);
      } else {
        response = await next();
      }
    }
  } else {
    // Pages: dashboard follows the public-view flag; /admin always renders its
    // sign-in shell (the data it fetches is gated by the /api rules above).
    if (!isPublicView() && !hasSession(context) && pathname !== "/admin") {
      response = context.redirect("/admin", 302);
    } else {
      response = await next();
    }
  }
  return withHardeningHeaders(response);
};
