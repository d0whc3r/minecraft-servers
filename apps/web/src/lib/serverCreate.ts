// Create/delete servers live from the panel: validates input, assembles an
// itzg/minecraft-server env file (same format as config/modpacks/*.env, so
// the docker scripts and the kubernetes values builder both consume it) and
// writes it into the runtime's writable dir. World data is never touched.
import fs from "node:fs";
import path from "node:path";
import {
  getServerDef,
  invalidateRegistry,
  MANAGED_MARKER,
  nextRconPort,
  serverEnvPath,
  writableServerDir,
  type ServerDef,
} from "@/lib/servers.js";

/** Player routes and container names build on this: keep it DNS-safe. */
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/;
const RCON_RANGE = { min: 26565, max: 26664 };

export interface ServerTypeSpec {
  label: string;
  /** itzg TYPE value, empty for plain VANILLA (itzg's default). */
  type: string;
  /** Modpack reference env key (CurseForge page URL vs CF_SLUG). */
  modpackKey?: "CF_PAGE_URL" | "CF_SLUG" | "MODRINTH_MODPACK";
  /** Accepts full URLs (CF_PAGE_URL / MODRINTH_MODPACK) or bare slugs. */
  modpackRequired?: boolean;
  defaultVersion: string;
}

/**
 * Server types the create form offers. CurseForge/Modrinth download the pack
 * at first start (needs the shared CF_API_KEY for CurseForge); plain server
 * types just pick a VERSION.
 */
export const SERVER_TYPES: Record<string, ServerTypeSpec> = {
  vanilla: { label: "Vanilla", type: "VANILLA", defaultVersion: "latest" },
  paper: { label: "Paper", type: "PAPER", defaultVersion: "latest" },
  fabric: { label: "Fabric", type: "FABRIC", defaultVersion: "latest" },
  forge: { label: "Forge", type: "FORGE", defaultVersion: "latest" },
  neoforge: { label: "NeoForge", type: "NEOFORGE", defaultVersion: "latest" },
  curseforge: {
    label: "CurseForge modpack",
    type: "AUTO_CURSEFORGE",
    modpackKey: "CF_PAGE_URL",
    modpackRequired: true,
    defaultVersion: "",
  },
  modrinth: {
    label: "Modrinth modpack",
    type: "MODRINTH",
    modpackKey: "MODRINTH_MODPACK",
    modpackRequired: true,
    defaultVersion: "",
  },
};

const MEMORY_RE = /^\d{1,5}\s?[MG]$/i;

/** Input the create API accepts (JSON body, all optional beyond name/type). */
export interface CreateServerInput {
  name: string;
  type: string;
  modpack?: string;
  version?: string;
  memory?: string;
  maxPlayers?: number;
  difficulty?: string;
  motd?: string;
  /** Extra itzg env lines, "KEY=VALUE" per line, merged last. */
  extraEnv?: string;
}

/** Validate the JSON boundary before string operations or writing any files. */
function assertCreateInput(input: unknown): asserts input is CreateServerInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Expected a server configuration object");
  }
  const fields = input as Record<string, unknown>;
  for (const key of ["name", "type"]) {
    if (typeof fields[key] !== "string") {
      throw new Error(`'${key}' is required and must be a string`);
    }
  }
  for (const key of ["name", "type", "modpack", "version", "memory", "difficulty", "motd"]) {
    const value = fields[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || /[\r\n\0]/.test(value)) {
      throw new Error(`'${key}' must be a single-line string`);
    }
    if (value.length > (key === "motd" ? 120 : 4096)) {
      throw new Error(`'${key}' is too long`);
    }
  }
  if (fields.maxPlayers !== undefined &&
      (typeof fields.maxPlayers !== "number" || !Number.isInteger(fields.maxPlayers))) {
    throw new Error("Max players must be an integer between 1 and 1000.");
  }
  if (fields.extraEnv !== undefined &&
      (typeof fields.extraEnv !== "string" || fields.extraEnv.length > 65536 || fields.extraEnv.includes("\0"))) {
    throw new Error("Extra settings must be text of at most 64 KiB without NUL characters");
  }
}

/** Only the panel-managed routing plumbing: everything else is overridable. */
const RESERVED_KEYS = new Set([
  "SERVER_NAME",
  "RCON_PORT",
  "SERVER_PORT",
  "MC_ROUTER_DOMAIN",
]);

export function validateServerName(name: string): string | null {
  if (!NAME_RE.test(name)) {
    return "Use 2-40 lowercase letters, numbers and hyphens (no leading/trailing hyphen).";
  }
  if (getServerDef(name)) return `A server named "${name}" already exists.`;
  return null;
}

function parseExtraEnv(raw: string | undefined): {
  env: Record<string, string>;
  error: string | null;
} {
  const env: Record<string, string> = {};
  for (const line of (raw ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0 || !/^[A-Z_][A-Z0-9_]*$/.test(trimmed.slice(0, eq))) {
      return {
        env: {},
        error: `Invalid extra setting: "${trimmed}" (expected KEY=VALUE, KEY in CAPS)`,
      };
    }
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).trim();
  }
  return { env, error: null };
}

function normalizeModpack(
  spec: ServerTypeSpec,
  modpack: string | undefined,
): { value: string; error: string | null } {
  const value = (modpack ?? "").trim();
  if (!value && spec.modpackRequired) {
    return {
      value,
      error: `A ${spec.label} reference is required (URL or slug).`,
    };
  }
  if (value && spec.modpackRequired && !/^[a-zA-Z0-9_-]+$/.test(value)) {
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        throw new Error("Invalid URL");
      }
    } catch {
      return { value, error: "Modpack must be an HTTP(S) URL or a slug." };
    }
  }
  return { value, error: null };
}

/** The env record a created server's file contains, in file order. */
export function buildServerEnv(
  input: CreateServerInput,
  rconPort: number,
): { env: Record<string, string>; error: string | null } {
  assertCreateInput(input);
  if (!Object.hasOwn(SERVER_TYPES, input.type)) {
    return { env: {}, error: `Unknown server type: ${input.type}` };
  }
  const spec = SERVER_TYPES[input.type];

  const nameError = validateServerName(input.name);
  if (nameError) return { env: {}, error: nameError };

  const modpack = normalizeModpack(spec, input.modpack);
  if (modpack.error) return { env: {}, error: modpack.error };

  const memory = (input.memory ?? "4G").replace(/\s+/g, "").toUpperCase();
  if (!MEMORY_RE.test(memory) || parseInt(memory, 10) === 0) {
    return { env: {}, error: `Invalid memory: "${memory}" (e.g. 4G, 512M).` };
  }

  const maxPlayers = input.maxPlayers ?? 20;
  if (!Number.isFinite(maxPlayers) || maxPlayers < 1 || maxPlayers > 1000) {
    return { env: {}, error: "Max players must be between 1 and 1000." };
  }

  const difficulty = (input.difficulty ?? "normal").toLowerCase();
  if (!["peaceful", "easy", "normal", "hard"].includes(difficulty)) {
    return { env: {}, error: `Invalid difficulty: "${difficulty}".` };
  }

  const extra = parseExtraEnv(input.extraEnv);
  if (extra.error) return { env: {}, error: extra.error };
  for (const key of RESERVED_KEYS) {
    delete extra.env[key];
  }

  const version = input.version?.trim() || spec.defaultVersion;
  // Slugs and URLs use different itzg settings for CurseForge.
  const modpackKey =
    spec.modpackKey === "CF_PAGE_URL" && !/^https?:\/\//.test(modpack.value)
      ? "CF_SLUG"
      : spec.modpackKey;
  const env: Record<string, string> = {
    TYPE: spec.type,
    ...(modpackKey && modpack.value ? { [modpackKey]: modpack.value } : {}),
    ...(version ? { VERSION: version } : {}),
    MEMORY: memory,
    SERVER_NAME: input.name,
    RCON_PORT: String(rconPort),
    MAX_PLAYERS: String(maxPlayers),
    DIFFICULTY: difficulty,
    ENABLE_RCON: "true",
    // RCON_PASSWORD, EULA, CF_API_KEY… come from the shared .env
    ...(input.motd?.trim() ? { MOTD: input.motd.trim() } : {}),
    ...extra.env,
  };
  return { env, error: null };
}

function serializeEnv(env: Record<string, string>): string {
  return `${MANAGED_MARKER}\n${Object.entries(env)
    .map(([k, v]) => {
      if (/[\r\n\0]/.test(v)) throw new Error(`'${k}' must be a single-line value`);
      // Compose quoting preserves literal text, including dollars and trailing
      // backslashes. The registry decodes these escapes for Kubernetes too.
      const value = /^[a-zA-Z0-9_./:@+-]*$/.test(v)
        ? v
        : `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, () => "$$")}"`;
      return `${k}=${value}`;
    })
    .join("\n")}\n`;
}

export interface CreateServerResult {
  name: string;
  rconPort: number;
  file: string;
  def: ServerDef;
}

/**
 * Validates, allocates a free RCON port and writes the env file. The registry
 * is invalidated so the new server shows up on the next status poll without a
 * panel restart.
 */
export function createServer(input: unknown): CreateServerResult {
  assertCreateInput(input);
  const rconPort = nextRconPort();
  if (!rconPort) {
    throw new Error(
      `No free RCON ports in ${RCON_RANGE.min}-${RCON_RANGE.max}; remove unused servers first.`,
    );
  }

  const { env, error } = buildServerEnv(input, rconPort);
  if (error) throw new Error(error);

  const dir = writableServerDir();
  const file = path.join(dir, `${input.name}.env`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, serializeEnv(env), { flag: "wx", mode: 0o600 });
  invalidateRegistry();

  const def = getServerDef(input.name);
  if (!def) {
    // Only possible if the write raced a delete; treat as a hard failure.
    fs.rmSync(file, { force: true });
    throw new Error("Server file written but the registry did not pick it up");
  }
  return { name: input.name, rconPort, file, def };
}

/** Removes a panel-created server's config. World data and backups stay. */
export function deleteServer(name: string): { file: string } {
  const def = getServerDef(name);
  if (!def) throw new Error(`Unknown server: ${name}`);
  if (def.source !== "custom") {
    throw new Error(
      `"${name}" belongs to the repo catalog; remove its config/modpacks file manually.`,
    );
  }
  const file = serverEnvPath(name);
  fs.rmSync(file, { force: true });
  invalidateRegistry();
  return { file };
}
