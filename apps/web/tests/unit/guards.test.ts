// Unit tests for the API route guards (auth, CSRF, server param) with a mock
// Astro route context.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { APIRoute } from "astro";

let dataDir: string;

beforeEach(async () => {
  vi.resetModules();
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcpanel-guard-"));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mcpanel-root-"));
  fs.mkdirSync(path.join(root, "config/modpacks"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "config/modpacks", "vanilla.env"),
    "TYPE=PAPER\nRCON_PORT=26567\n",
  );
  process.env.MCPANEL_DATA_DIR = dataDir;
  process.env.MCPANEL_ROOT = root;
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.rmSync(process.env.MCPANEL_ROOT!, { recursive: true, force: true });
  delete process.env.MCPANEL_DATA_DIR;
  delete process.env.MCPANEL_ROOT;
});

async function load() {
  const auth = await import("../../src/lib/auth");
  const api = await import("../../src/lib/api");
  auth.ensureAuthConfigured();
  return { auth, api };
}

function makeContext(opts: {
  cookie?: string;
  headers?: Record<string, string>;
  server?: string;
}) {
  return {
    cookies: {
      get: (name: string) =>
        opts.cookie !== undefined ? { value: opts.cookie } : undefined,
    },
    request: { headers: new Headers(opts.headers) },
    params: { server: opts.server },
    clientAddress: "127.0.0.1",
    url: new URL("http://panel.local/test"),
  } as unknown as Parameters<APIRoute>[0];
}

describe("guardAuth", () => {
  it("rejects requests without a session cookie", async () => {
    const { api } = await load();
    const res = api.guardAuth(makeContext({}));
    expect(res).toBeInstanceOf(Response);
    expect(res!.status).toBe(401);
  });

  it("rejects tampered cookies", async () => {
    const { auth, api } = await load();
    const res = api.guardAuth(makeContext({ cookie: "123.abc" }));
    expect(res!.status).toBe(401);
    void auth;
  });

  it("accepts a valid session token", async () => {
    const { auth, api } = await load();
    const { token } = auth.createSessionToken();
    const res = api.guardAuth(makeContext({ cookie: token }));
    expect(res).toBeNull();
  });
});

describe("guardCsrf", () => {
  it("rejects mutations without the x-mcpanel header", async () => {
    const { api } = await load();
    expect(api.guardCsrf(makeContext({}))!.status).toBe(403);
  });

  it("accepts mutations carrying the x-mcpanel header", async () => {
    const { api } = await load();
    const res = api.guardCsrf(makeContext({ headers: { "x-mcpanel": "1" } }));
    expect(res).toBeNull();
  });
});

describe("getServerParam", () => {
  it("accepts configured server names", async () => {
    const { api } = await load();
    expect(api.getServerParam(makeContext({ server: "vanilla" }))).toBe(
      "vanilla",
    );
  });

  it("rejects malformed or unknown names", async () => {
    const { api } = await load();
    expect(api.getServerParam(makeContext({ server: "../etc" }))).toBeNull();
    expect(api.getServerParam(makeContext({ server: "Nope" }))).toBeNull();
    expect(api.getServerParam(makeContext({ server: "ghost" }))).toBeNull();
  });
});

describe("clientIp", () => {
  beforeEach(() => {
    delete process.env.MCPANEL_TRUST_PROXY;
  });

  it("ignores X-Forwarded-For by default so it cannot rotate the rate-limit bucket", async () => {
    const { api } = await load();
    const res = api.clientIp(
      makeContext({ headers: { "x-forwarded-for": "9.9.9.9" } }),
    );
    expect(res).toBe("127.0.0.1");
  });

  it("honors X-Forwarded-For only behind a trusted proxy", async () => {
    process.env.MCPANEL_TRUST_PROXY = "true";
    const { api } = await load();
    const res = api.clientIp(
      makeContext({
        headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" },
      }),
    );
    expect(res).toBe("9.9.9.9");
  });

  it("falls back to the socket address without the header", async () => {
    const { api } = await load();
    expect(api.clientIp(makeContext({}))).toBe("127.0.0.1");
  });
});
