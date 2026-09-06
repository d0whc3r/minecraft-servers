// Server registry: reads the repo layout (config/modpacks/*.env + shared .env +
// docs/modpacks/*.md) and exposes the list of manageable servers.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { K8S_RCON_PORT, RUNTIME, rconServiceDns } from "@/lib/runtime.js";

export interface ServerDef {
  name: string;
  title: string;
  platform: string;
  mcVersion: string;
  memory: string;
  type: string;
  /** Player-facing address: "<server-name>.<MC_ROUTER_DOMAIN>" via mc-router. */
  connect: string;
  /** Loopback-only RCON port (managed range 26565-26664). */
  rconPort: number | null;
  /** Where to reach RCON (loopback natively, container name in Docker). */
  rconHost: string;
  maxPlayers: number;
  description: string;
  /** Official modpack page (CurseForge/Modrinth) so players can verify the pack against their client. */
  modUrl: string | null;
  /** Merged env (shared .env overridden by server env) with secrets intact */
  env: Record<string, string>;
}

function findProjectRoot(): string {
  if (
    process.env.MCPANEL_ROOT &&
    fs.existsSync(path.join(process.env.MCPANEL_ROOT, "config/modpacks"))
  ) {
    return path.resolve(process.env.MCPANEL_ROOT);
  }
  const candidates = [
    process.cwd(),
    fileURLToPath(new URL(".", import.meta.url)),
  ];
  for (const start of candidates) {
    let dir = path.resolve(start);
    for (let i = 0; i < 8; i++) {
      if (fs.existsSync(path.join(dir, "config/modpacks"))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return path.resolve(process.cwd());
}

export const PROJECT_ROOT = findProjectRoot();

function parseEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  let raw = "";
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed
      .slice(0, eq)
      .trim()
      .replace(/^export\s+/, "");
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function prettifyName(name: string): string {
  return name
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function readDocMeta(name: string): { title?: string; description?: string } {
  const docPath = path.join(PROJECT_ROOT, "docs/modpacks", `${name}.md`);
  if (!fs.existsSync(docPath)) return {};
  const raw = fs.readFileSync(docPath, "utf8");
  const lines = raw.split(/\r?\n/);
  let title: string | undefined;
  let description: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!title && line.startsWith("# ") && line.length > 2) {
      title = line.slice(2).trim();
      continue;
    }
    if (!description && /^## Overview/i.test(line)) {
      for (let j = i + 1; j < lines.length; j++) {
        const d = lines[j].trim();
        if (!d || d.startsWith("#")) continue;
        description = d.replace(/\s+/g, " ").slice(0, 220);
        break;
      }
    }
    if (title && description) break;
  }
  return { title, description };
}

function detectPlatform(env: Record<string, string>, type: string): string {
  if (env.MODRINTH_MODPACK) return "Modrinth";
  if (env.AUTO_CURSEFORGE || /CURSEFORGE/i.test(type)) return "CurseForge";
  if (/PAPER/i.test(type)) return "Paper";
  if (/FABRIC/i.test(type)) return "Fabric";
  if (/VANILLA/i.test(type)) return "Vanilla";
  if (/SPIGOT/i.test(type)) return "Spigot";
  if (/FORGE/i.test(type)) return "Forge";
  if (/NEOFORGE/i.test(type)) return "NeoForge";
  return type ? type.charAt(0) + type.slice(1).toLowerCase() : "Unknown";
}

/**
 * Official modpack page, from whatever source field the pack declares:
 * MODRINTH_MODPACK (slug or URL), CF_PAGE_URL, or AUTO_CURSEFORGE (slug or URL).
 * Server types without a modpack (Paper, Vanilla,…) return null.
 */
function modpackUrl(env: Record<string, string>): string | null {
  const asUrl = (value: string, base: string) =>
    /^https?:\/\//.test(value) ? value : base + value;
  if (env.MODRINTH_MODPACK)
    return asUrl(env.MODRINTH_MODPACK, "https://modrinth.com/modpack/");
  if (env.CF_PAGE_URL) return env.CF_PAGE_URL;
  if (env.AUTO_CURSEFORGE)
    return asUrl(
      env.AUTO_CURSEFORGE,
      "https://www.curseforge.com/minecraft/modpacks/",
    );
  return null;
}

export function listServerNames(): string[] {
  const dir = path.join(PROJECT_ROOT, "config/modpacks");
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".env"))
      .map((f) => f.slice(0, -4))
      .sort();
  } catch {
    return [];
  }
}

interface Registry {
  servers: Map<string, ServerDef>;
  router: RouterConfig;
  loadedAt: number;
}

let registry: Registry | null = null;
let routerConfig: RouterConfig | null = null;
const REGISTRY_TTL_MS = 30_000;

export interface RouterConfig {
  /** Where the panel connects to mc-router (127.0.0.1 natively, or the
   *  container name "minecraft-router" when the panel runs containerized). */
  host: string;
  /** Suffix for player routes: players use "<server>.<domain>". */
  domain: string;
  /** Public entry point where mc-router listens. */
  port: number;
}

const DEFAULT_ROUTER: RouterConfig = {
  host: process.env.MCPANEL_ROUTER_HOST || "127.0.0.1",
  domain: "mc.local",
  port: 25565,
};

/**
 * Host used for RCON connections.
 * - Docker runtime: loopback publishing natively, container name when the
 *   panel runs containerized (MCPANEL_RCON_HOST=container).
 * - Kubernetes runtime: each server's in-cluster Service, which the
 *   minecraft-server chart exposes with RCON on a fixed internal port.
 */
export function rconHost(name: string): string {
  if (RUNTIME === "kubernetes") return rconServiceDns(name);
  if (process.env.MCPANEL_RCON_HOST === "container") return `mc-${name}`;
  return process.env.MCPANEL_RCON_HOST || "127.0.0.1";
}

/** RCON port for a server, runtime-aware (see rconHost). */
export function rconPortFor(serverEnvPort: number | null): number | null {
  // The chart pins RCON to a fixed internal port; the per-server ports in the
  // configs only made sense as docker host publishings.
  if (RUNTIME === "kubernetes") return K8S_RCON_PORT;
  return serverEnvPort;
}

export function getRouterConfig(): RouterConfig {
  buildRegistry();
  return routerConfig ?? DEFAULT_ROUTER;
}

export function getServerRegistry(): Map<string, ServerDef> {
  buildRegistry();
  return registry!.servers;
}

function buildRegistry() {
  const now = Date.now();
  if (registry && now - registry.loadedAt < REGISTRY_TTL_MS) return;

  const shared = parseEnvFile(path.join(PROJECT_ROOT, ".env"));
  const router: RouterConfig = {
    host: DEFAULT_ROUTER.host,
    domain: shared.MC_ROUTER_DOMAIN || DEFAULT_ROUTER.domain,
    port: shared.MC_ROUTER_PORT
      ? Number(shared.MC_ROUTER_PORT)
      : DEFAULT_ROUTER.port,
  };

  const servers = new Map<string, ServerDef>();
  for (const name of listServerNames()) {
    const envPath = path.join(PROJECT_ROOT, "config/modpacks", `${name}.env`);
    const serverEnv = parseEnvFile(envPath);
    const env = { ...shared, ...serverEnv };
    const type = env.TYPE ?? "";
    const doc = readDocMeta(name);
    const slug = env.SERVER_NAME || name;
    servers.set(name, {
      name,
      title: doc.title ?? env.SERVER_NAME ?? prettifyName(name),
      platform: detectPlatform(serverEnv, type),
      mcVersion: env.VERSION ?? "?",
      memory: env.MEMORY ?? "?",
      type,
      connect: `${slug}.${router.domain}`,
      rconPort: rconPortFor(
        serverEnv.RCON_PORT ? Number(serverEnv.RCON_PORT) : null,
      ),
      rconHost: rconHost(name),
      maxPlayers: env.MAX_PLAYERS ? Number(env.MAX_PLAYERS) : 20,
      description: doc.description ?? "",
      modUrl: modpackUrl(env),
      env,
    });
  }
  routerConfig = router;
  registry = { servers, router, loadedAt: now };
}

export function getServerDef(name: string): ServerDef | null {
  return getServerRegistry().get(name) ?? null;
}

export function rconPassword(def: ServerDef): string | null {
  return def.env.RCON_PASSWORD || null;
}

/** Mask values of sensitive keys before exposing config to the client. */
export function maskSecrets(
  env: Record<string, string>,
): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    masked[k] = /PASSWORD|API_KEY|TOKEN|SECRET/i.test(k) ? "••••••••" : v;
  }
  return masked;
}
