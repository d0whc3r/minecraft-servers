// Panel auth: single admin user, scrypt-hashed password, HMAC-signed session
// cookie, simple in-memory login rate limiting.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "./servers.js";

const PANEL_DATA_DIR = process.env.MCPANEL_DATA_DIR
  ? path.resolve(process.env.MCPANEL_DATA_DIR)
  : path.join(PROJECT_ROOT, "apps", "web", "data");
const AUTH_FILE = path.join(PANEL_DATA_DIR, "auth.json");
const SECRET_FILE = path.join(PANEL_DATA_DIR, "secret.key");

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_COOKIE = "mcpanel_session";

interface AuthRecord {
  user: string;
  salt: string;
  hash: string;
}

let cachedAuth: AuthRecord | null = null;
let cachedSecret: Buffer | null = null;
/** Guards against re-hashing credentials on every request in this process. */
let bootstrapped = false;

function scryptHash(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

export function verifyCredentials(user: string, password: string): boolean {
  ensureAuthConfigured(); // no-op once apps/web/data/auth.json exists
  const record = loadAuthRecord();
  if (!record) return false;
  const givenUser = Buffer.from(user);
  const expectedUser = Buffer.from(record.user);
  const userOk =
    givenUser.length === expectedUser.length &&
    crypto.timingSafeEqual(givenUser, expectedUser);
  const givenHash = Buffer.from(scryptHash(password, record.salt), "hex");
  const expectedHash = Buffer.from(record.hash, "hex");
  const passOk =
    givenHash.length === expectedHash.length &&
    crypto.timingSafeEqual(givenHash, expectedHash);
  return userOk && passOk;
}

function loadAuthRecord(): AuthRecord | null {
  if (cachedAuth) return cachedAuth;
  try {
    cachedAuth = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8")) as AuthRecord;
    return cachedAuth;
  } catch {
    return null;
  }
}

/** Creates apps/web/data/auth.json on first boot; prints credentials once. */
export function ensureAuthConfigured(): {
  user: string;
  generatedPassword?: string;
} {
  // Memoized: zero filesystem cost per request. Credential changes therefore
  // require a panel restart (documented in the README).
  if (bootstrapped) return { user: cachedAuth?.user ?? "admin" };

  const envUser = process.env.MCPANEL_USER;
  const envPass = process.env.MCPANEL_PASSWORD;
  if (!envUser && !envPass && fs.existsSync(AUTH_FILE)) {
    bootstrapped = true;
    return { user: loadAuthRecord()?.user ?? "admin" };
  }
  fs.mkdirSync(PANEL_DATA_DIR, { recursive: true });
  const user = envUser || "admin";
  // 6 random bytes = 12 hex chars (~48 bits): fine for a first-boot
  // convenience secret that the operator is told to replace or store.
  const generatedPassword = envPass
    ? undefined
    : crypto.randomBytes(6).toString("hex");
  const password = envPass || generatedPassword!;
  const salt = crypto.randomBytes(16).toString("hex");
  const record: AuthRecord = { user, salt, hash: scryptHash(password, salt) };
  fs.writeFileSync(AUTH_FILE, JSON.stringify(record, null, 2), { mode: 0o600 });
  cachedAuth = record;
  bootstrapped = true;
  if (generatedPassword) {
    // eslint-disable-next-line no-console
    console.log(
      `\n  ┌──────────────────────────────────────────────────────┐\n` +
        `  │  Minecraft Servers admin panel                       │\n` +
        `  │  User: ${user.padEnd(50)}│\n` +
        `  │  Generated password: ${generatedPassword.padEnd(35)}│\n` +
        `  │  (store it now, or set MCPANEL_PASSWORD instead)     │\n` +
        `  └──────────────────────────────────────────────────────┘\n`,
    );
  }
  return { user, generatedPassword };
}

function getSecret(): Buffer {
  if (cachedSecret) return cachedSecret;
  fs.mkdirSync(PANEL_DATA_DIR, { recursive: true });
  if (!fs.existsSync(SECRET_FILE)) {
    fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString("hex"), {
      mode: 0o600,
    });
  }
  cachedSecret = Buffer.from(
    fs.readFileSync(SECRET_FILE, "utf8").trim(),
    "hex",
  );
  return cachedSecret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionToken(): { token: string; expires: Date } {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = String(exp);
  return { token: `${payload}.${sign(payload)}`, expires: new Date(exp) };
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && exp > Date.now();
}

export const sessionCookieName = SESSION_COOKIE;
export const sessionCookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.MCPANEL_SECURE_COOKIES === "true",
  maxAge: SESSION_TTL_MS / 1000,
};

export function isPublicView(): boolean {
  return (process.env.MCPANEL_PUBLIC_VIEW ?? "true") !== "false";
}

// ---- Login rate limiting ----------------------------------------------------
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

export function isRateLimited(ip: string): boolean {
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < Date.now()) return false;
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(ip: string): void {
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < Date.now()) {
    attempts.set(ip, { count: 1, resetAt: Date.now() + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export function clearAttempts(ip: string): void {
  attempts.delete(ip);
}
