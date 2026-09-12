// Docker helpers: thin wrappers around the docker CLI (the panel runs on the
// host, where docker access is already configured).
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const DOCKER_TIMEOUT_MS = 15_000;

interface DockerPsEntry {
  Names: string | string[];
  State: string;
  Status: string;
  Image: string;
  CreatedAt: string;
  /** Podman's docker-compatible CLI emits unix seconds; real Docker omits it. */
  StartedAt?: number | string;
}

export interface ContainerInfo {
  name: string;
  state: string;
  statusText: string;
  health: string | null;
  uptimeSec: number | null;
}

/** Docker emits "Names": "mc-x"; Podman emits "Names": ["mc-x"]. */
function containerName(names: DockerPsEntry["Names"]): string {
  return Array.isArray(names) ? (names[0] ?? "") : (names ?? "");
}

/**
 * Health token from the status. Real Docker prose: "Up 2 minutes (healthy)",
 * "Up 5 seconds (health: starting)". Podman's JSON status is the bare word:
 * "healthy" / "unhealthy" with no "Up …" prose around it.
 */
function parseHealth(status: string): string | null {
  const paren = /\((?:health:\s*)?(healthy|unhealthy|starting)\)/i.exec(status);
  if (paren) return paren[1].toLowerCase();
  const bare = /^(healthy|unhealthy|starting)$/i.exec(status.trim());
  return bare ? bare[1].toLowerCase() : null;
}

function parseUptimeSeconds(entry: DockerPsEntry): number | null {
  // Podman's JSON status carries no "Up …" prose, but StartedAt (unix
  // seconds) does; real Docker omits the field entirely. Only meaningful for
  // live containers, which is all deriveState uses it for.
  const started = Number(entry.StartedAt);
  if (
    entry.StartedAt !== undefined &&
    Number.isFinite(started) &&
    started > 1e9
  ) {
    const seconds = Math.floor(Date.now() / 1000) - started;
    if (seconds >= 0) return seconds;
  }
  // Real Docker prose examples: "Up 6 hours", "Up About a minute",
  // "Up 3 days 2 hours", "Up 5 minutes (healthy)",
  // "Exited (0) 2 days ago", "Restarting (1) 40 seconds ago"
  const m =
    /(?:Up|Restarting|Exited[^)]*\))\s+(?:About\s+)?(.+?)(?:\s+\((?:health:\s*)?(?:healthy|unhealthy|starting)\))?$/i.exec(
      entry.Status,
    );
  if (!m) return null;
  let seconds = 0;
  const units: Array<[RegExp, number]> = [
    [/(\d+)\s*day/i, 86400],
    [/(\d+)\s*hour/i, 3600],
    [/(\d+)\s*minute/i, 60],
    [/(\d+)\s*second/i, 1],
  ];
  let matched = false;
  for (const [re, mult] of units) {
    const u = re.exec(m[1]);
    if (u) {
      seconds += Number(u[1]) * mult;
      matched = true;
    }
  }
  return matched ? seconds : null;
}

export async function listContainers(): Promise<Map<string, ContainerInfo>> {
  const map = new Map<string, ContainerInfo>();
  try {
    const { stdout } = await exec(
      "docker",
      ["ps", "-a", "--filter", "name=mc-", "--format", "{{json .}}"],
      { timeout: DOCKER_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
    );
    for (const line of stdout.split("\n")) {
      if (!line.trim()) continue;
      let entry: DockerPsEntry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      map.set(containerName(entry.Names), {
        name: containerName(entry.Names),
        state: entry.State,
        statusText: entry.Status,
        health: parseHealth(entry.Status),
        uptimeSec: parseUptimeSeconds(entry),
      });
    }
  } catch {
    // docker unreachable: leave map empty, panel shows "sin contenedor"
  }
  return map;
}

/** Fresh, strict check for destructive operations; command/parse errors propagate. */
export async function isServerStopped(server: string): Promise<boolean> {
  const name = `mc-${server}`;
  const { stdout } = await exec(
    "docker",
    ["ps", "-a", "--filter", `name=^/${name}$`, "--format", "{{json .}}"],
    { timeout: DOCKER_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
  );
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    const entry: DockerPsEntry = JSON.parse(line);
    if (
      containerName(entry.Names) !== name ||
      typeof entry.State !== "string"
    ) {
      throw new Error("Unexpected Docker container state response");
    }
    if (entry.State !== "exited" && entry.State !== "dead") return false;
  }
  return true;
}

export interface ContainerStats {
  cpuPerc: number;
  memUsed: string;
  memLimit: string;
  memPerc: number;
}

let statsCache: { at: number; data: Map<string, ContainerStats> } | null = null;

export async function getStats(): Promise<Map<string, ContainerStats>> {
  if (statsCache && Date.now() - statsCache.at < 4_000) return statsCache.data;
  const map = new Map<string, ContainerStats>();
  try {
    // `docker stats` has no name filter; fetch all and filter here.
    const { stdout } = await exec(
      "docker",
      [
        "stats",
        "--no-stream",
        "--format",
        "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}",
      ],
      { timeout: DOCKER_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
    );
    for (const line of stdout.split("\n")) {
      const [name, cpu, mem, memPerc] = line.trim().split("\t");
      if (!name || !name.startsWith("mc-") || !cpu) continue;
      map.set(name, {
        cpuPerc: parseFloat(cpu) || 0,
        memUsed: (mem ?? "").split("/")[0].trim() || "?",
        memLimit: (mem ?? "").split("/")[1]?.trim() ?? "?",
        memPerc: parseFloat(memPerc ?? "") || 0,
      });
    }
  } catch {
    // stats unavailable (docker busy) — cards just skip the usage bars
  }
  statsCache = { at: Date.now(), data: map };
  return map;
}

export async function getRecentLogs(
  container: string,
  tail: number,
): Promise<string> {
  const { stdout } = await exec(
    "docker",
    ["logs", "--tail", String(tail), container],
    {
      timeout: DOCKER_TIMEOUT_MS,
      maxBuffer: 4 * 1024 * 1024,
    },
  ).catch((err) => ({
    stdout: "",
    stderr: String(err.stderr ?? err.message ?? ""),
  }));
  return stdout || "";
}

export async function getDockerVersion(): Promise<string | null> {
  try {
    const { stdout } = await exec(
      "docker",
      ["version", "--format", "{{.Server.Version}}"],
      {
        timeout: DOCKER_TIMEOUT_MS,
      },
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
