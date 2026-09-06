import type { APIRoute } from "astro";
import { backend } from "@/lib/backend.js";
import { apiError, guardAuth, getServerParam } from "@/lib/api.js";

export const prerender = false;

const ANSI_REGEX =
  // eslint-disable-next-line no-control-regex
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g;

export const GET: APIRoute = async (context) => {
  const denied = guardAuth(context);
  if (denied) return denied;
  const server = getServerParam(context);
  if (!server) return apiError("Unknown server", 404);

  const tail = Math.min(
    Math.max(Number(context.url.searchParams.get("tail") ?? 300), 1),
    5000,
  );
  try {
    const raw = await backend.getRecentLogs(server, tail);
    return new Response(raw.replace(ANSI_REGEX, ""), {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return apiError(
      `No se pudieron leer los logs: ${(err as Error).message}`,
      500,
    );
  }
};
