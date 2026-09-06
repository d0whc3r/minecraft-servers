// Unit tests for the central authorization middleware.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

let dataDir: string;
let root: string;

beforeEach(async () => {
  vi.resetModules();
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcpanel-mw-data-"));
  root = fs.mkdtempSync(path.join(os.tmpdir(), "mcpanel-mw-root-"));
  fs.mkdirSync(path.join(root, "config/modpacks"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "config/modpacks/vanilla.env"),
    "TYPE=PAPER",
  );
  process.env.MCPANEL_DATA_DIR = dataDir;
  process.env.MCPANEL_ROOT = root;
  delete process.env.MCPANEL_PUBLIC_VIEW;
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.rmSync(root, { recursive: true, force: true });
  delete process.env.MCPANEL_DATA_DIR;
  delete process.env.MCPANEL_ROOT;
});

async function load() {
  const mw = await import("../../src/middleware");
  const auth = await import("../../src/lib/auth");
  const { token } = auth.createSessionToken();
  return { onRequest: mw.onRequest, token };
}

function makeContext(
  pathname: string,
  opts: {
    method?: string;
    cookie?: string;
    headers?: Record<string, string>;
  } = {},
): APIContext {
  return {
    url: new URL(`http://panel.local${pathname}`),
    request: new Request(`http://panel.local${pathname}`, {
      method: opts.method ?? "GET",
      headers: opts.headers,
    }),
    cookies: {
      get: (name: string) =>
        opts.cookie !== undefined ? { value: opts.cookie } : undefined,
    },
    redirect: (to: string, status = 302) =>
      new Response(null, { status, headers: { location: to } }),
  } as unknown as APIContext;
}

const nextPage = async () =>
  new Response("<html>page</html>", {
    headers: { "content-type": "text/html" },
  });

describe("middleware authorization", () => {
  it("allows the public API surface without a session", async () => {
    const { onRequest } = await load();
    for (const path of ["/api/auth/me", "/api/auth/logout"]) {
      const res = await onRequest(
        makeContext(path, { method: "POST", headers: { "x-mcpanel": "1" } }),
        nextPage,
      );
      expect(res?.status).toBe(200);
    }
  });

  it("allows public status requests", async () => {
    const { onRequest } = await load();
    const res = await onRequest(makeContext("/api/status"), nextPage);
    expect(res?.status).toBe(200);
  });

  it("blocks admin APIs without a session (401 JSON)", async () => {
    const { onRequest } = await load();
    for (const path of [
      "/api/system",
      "/api/config/vanilla",
      "/api/backups/vanilla",
      "/api/rcon/vanilla",
      "/api/action/vanilla/start",
    ]) {
      const res = await onRequest(
        makeContext(path, {
          method: path.includes("action") ? "POST" : "GET",
          headers: { "x-mcpanel": "1" },
        }),
        nextPage,
      );
      expect(res!.status, path).toBe(401);
      await expect(res!.json()).resolves.toEqual({
        error: "Not authenticated",
      });
    }
  });

  it("blocks admin APIs with a tampered cookie", async () => {
    const { onRequest } = await load();
    const res = await onRequest(
      makeContext("/api/system", { cookie: "123.tampered" }),
      nextPage,
    );
    expect(res!.status).toBe(401);
  });

  it("lets admin APIs through with a valid session", async () => {
    const { onRequest, token } = await load();
    const res = await onRequest(
      makeContext("/api/system", { cookie: token }),
      nextPage,
    );
    expect(res?.status).toBe(200);
  });

  it("rejects mutating admin API calls without the CSRF header", async () => {
    const { onRequest, token } = await load();
    const res = await onRequest(
      makeContext("/api/action/vanilla/start", {
        method: "POST",
        cookie: token, // valid session, no x-mcpanel header
      }),
      nextPage,
    );
    expect(res!.status).toBe(403);
  });

  it("locks the status API when public view is disabled", async () => {
    process.env.MCPANEL_PUBLIC_VIEW = "false";
    const { onRequest, token } = await load();
    const denied = await onRequest(makeContext("/api/status"), nextPage);
    expect(denied!.status).toBe(401);
    const allowed = await onRequest(
      makeContext("/api/status", { cookie: token }),
      nextPage,
    );
    expect(allowed?.status).toBe(200);
  });

  it("redirects the dashboard to the sign-in shell when locked down", async () => {
    process.env.MCPANEL_PUBLIC_VIEW = "false";
    const { onRequest, token } = await load();
    const res = await onRequest(makeContext("/"), nextPage);
    expect(res!.status).toBe(302);
    expect(res!.headers.get("location")).toBe("/admin");
    const authed = await onRequest(
      makeContext("/", { cookie: token }),
      nextPage,
    );
    expect(authed?.status).toBe(200);
  });

  it("always renders the /admin sign-in shell (no data in it)", async () => {
    process.env.MCPANEL_PUBLIC_VIEW = "false";
    const { onRequest } = await load();
    const res = await onRequest(makeContext("/admin"), nextPage);
    expect(res?.status).toBe(200);
  });

  it("attaches hardening headers to responses", async () => {
    const { onRequest } = await load();
    const res = await onRequest(makeContext("/"), nextPage);
    expect(res!.headers.get("x-frame-options")).toBe("DENY");
    expect(res!.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res!.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res!.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
  });

  it("attaches hardening headers to public API and rejected responses too", async () => {
    const { onRequest } = await load();
    for (const context of [
      makeContext("/api/auth/me"),
      makeContext("/api/system"),
      makeContext("/api/action/vanilla/start", { method: "POST" }),
      (() => {
        process.env.MCPANEL_PUBLIC_VIEW = "false";
        return makeContext("/");
      })(),
    ]) {
      const res = await onRequest(context, nextPage);
      expect(
        res!.headers.get("x-content-type-options"),
        context.url.pathname + context.request.method,
      ).toBe("nosniff");
      expect(res!.headers.get("content-security-policy")).toContain(
        "frame-ancestors 'none'",
      );
    }
  });
});
