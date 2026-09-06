import type { APIRoute } from "astro";
import {
  verifyCredentials,
  createSessionToken,
  sessionCookieName,
  sessionCookieOptions,
  isRateLimited,
  recordFailedAttempt,
  clearAttempts,
  isPublicView,
  ensureAuthConfigured,
} from "@/lib/auth.js";
import { json, apiError, clientIp } from "@/lib/api.js";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  ensureAuthConfigured(); // creates the admin record on very first login attempt
  const ip = clientIp(context);
  if (isRateLimited(ip)) {
    return apiError(
      "Too many failed attempts; try again in a few minutes",
      429,
    );
  }
  let body: { user?: string; password?: string };
  try {
    body = (await context.request.json()) as {
      user?: string;
      password?: string;
    };
  } catch {
    return apiError("Invalid request body", 400);
  }
  const user = (body.user ?? "").trim();
  const password = body.password ?? "";
  if (!user || !password)
    return apiError("Username and password are required", 400);

  if (!verifyCredentials(user, password)) {
    recordFailedAttempt(ip);
    return apiError("Invalid credentials", 401);
  }
  clearAttempts(ip);
  const { token, expires } = createSessionToken();
  context.cookies.set(sessionCookieName, token, {
    ...sessionCookieOptions,
    expires,
  });
  return json({ ok: true, user, publicView: isPublicView() });
};
