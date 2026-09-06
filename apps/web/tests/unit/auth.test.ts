// Unit tests for the auth module: credential bootstrap, scrypt verification,
// HMAC session tokens and the login rate limiter. All state lives in a temp
// MCPANEL_DATA_DIR so the real panel data is never touched.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let dataDir: string;

beforeEach(() => {
  vi.resetModules();
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcpanel-auth-"));
  process.env.MCPANEL_DATA_DIR = dataDir;
  delete process.env.MCPANEL_USER;
  delete process.env.MCPANEL_PASSWORD;
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function loadAuth() {
  return import("../../src/lib/auth");
}

describe("ensureAuthConfigured / verifyCredentials", () => {
  it("generates a random password when nothing is configured", async () => {
    const auth = await loadAuth();
    const { generatedPassword } = auth.ensureAuthConfigured();
    expect(generatedPassword).toMatch(/^[0-9a-f]{8}$/);
    expect(auth.verifyCredentials("admin", generatedPassword!)).toBe(true);
    expect(auth.verifyCredentials("admin", "wrong")).toBe(false);
  });

  it("uses MCPANEL_USER/MCPANEL_PASSWORD when provided", async () => {
    process.env.MCPANEL_USER = "ops";
    process.env.MCPANEL_PASSWORD = "s3cret!";
    const auth = await loadAuth();
    const { generatedPassword } = auth.ensureAuthConfigured();
    expect(generatedPassword).toBeUndefined();
    expect(auth.verifyCredentials("ops", "s3cret!")).toBe(true);
    expect(auth.verifyCredentials("admin", "s3cret!")).toBe(false);
    expect(auth.verifyCredentials("ops", "wrong")).toBe(false);
  });

  it("persists the record and survives a fresh module load", async () => {
    process.env.MCPANEL_PASSWORD = "keepme";
    const first = await loadAuth();
    first.ensureAuthConfigured();
    expect(fs.existsSync(path.join(dataDir, "auth.json"))).toBe(true);

    vi.resetModules();
    const second = await loadAuth();
    expect(second.verifyCredentials("admin", "keepme")).toBe(true);
  });

  it("rejects when the user name differs", async () => {
    process.env.MCPANEL_PASSWORD = "pw";
    const auth = await loadAuth();
    auth.ensureAuthConfigured();
    expect(auth.verifyCredentials("Admin", "pw")).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips a valid token and rejects tampered ones", async () => {
    const auth = await loadAuth();
    const { token } = auth.createSessionToken();
    expect(auth.verifySessionToken(token)).toBe(true);
    expect(auth.verifySessionToken(token + "x")).toBe(false);
    expect(auth.verifySessionToken("not-a-token")).toBe(false);
    expect(auth.verifySessionToken(undefined)).toBe(false);
  });

  it("expires after the session TTL", async () => {
    vi.useFakeTimers();
    const auth = await loadAuth();
    const { token } = auth.createSessionToken();
    expect(auth.verifySessionToken(token)).toBe(true);
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
    expect(auth.verifySessionToken(token)).toBe(false);
    vi.useRealTimers();
  });
});

describe("login rate limiting", () => {
  it("blocks an IP after MAX_ATTEMPTS failures and clears on success", async () => {
    const auth = await loadAuth();
    expect(auth.isRateLimited("1.2.3.4")).toBe(false);
    for (let i = 0; i < 8; i++) auth.recordFailedAttempt("1.2.3.4");
    expect(auth.isRateLimited("1.2.3.4")).toBe(true);
    auth.clearAttempts("1.2.3.4");
    expect(auth.isRateLimited("1.2.3.4")).toBe(false);
  });
});
