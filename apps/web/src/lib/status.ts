// Aggregates workload state + game ping + usage stats into one snapshot.
import {
  getRouterConfig,
  getServerRegistry,
  rconPassword,
} from "@/lib/servers.js";
import { backend } from "@/lib/backend.js";
import type { ContainerInfo, ContainerStats } from "@/lib/docker.js";
import { pingServer } from "@/lib/ping.js";
import { rconCommand } from "@/lib/rcon.js";
import type { ServerDef } from "@/lib/servers.js";
import type {
  ServerState,
  ServerStatus,
  StatusResponse,
  StatusSummary,
} from "@/types.js";

const STATUS_CACHE_MS = 3_000;
let cache: { at: number; data: StatusResponse } | null = null;

function deriveState(container: ContainerInfo | undefined): ServerState {
  if (!container) return "missing";
  if (container.state === "running") {
    if (container.health === "unhealthy") return "unhealthy";
    if (container.health === "starting") return "starting";
    // running but not accepting connections yet
    return container.uptimeSec !== null && container.uptimeSec < 300
      ? "starting"
      : "running";
  }
  if (container.state === "restarting") return "starting";
  return "stopped";
}

async function probePlayers(def: ServerDef) {
  // Primary: server list ping through mc-router using the server's routed
  // hostname — exactly the path a player takes. No per-server ports exist.
  const router = getRouterConfig();
  const ping = await pingServer(router.host, router.port, 2500, def.connect);
  if (ping) {
    return { ping };
  }
  // Fallback: RCON `list`
  const password = rconPassword(def);
  if (def.rconPort && password) {
    const res = await rconCommand(
      def.rconHost,
      def.rconPort,
      password,
      "list",
      3500,
    );
    if (res.ok) {
      // "There are 2 of a max of 20 players online: alice, bob"
      const m =
        /There are (\d+) of a max of (\d+) players online[:\s]*(.*)/i.exec(
          res.output,
        );
      if (m) {
        const names = m[3]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        return {
          ping: {
            latencyMs: null,
            motd: null,
            versionName: null,
            playersOnline: Number(m[1]),
            playersMax: Number(m[2]),
            playerSample: names,
            favicon: null,
          },
        };
      }
    }
  }
  return { ping: null };
}

export async function buildStatus(): Promise<StatusResponse> {
  if (cache && Date.now() - cache.at < STATUS_CACHE_MS) {
    return { ...cache.data, cached: true };
  }

  const registry = getServerRegistry();
  const [containers, stats] = await Promise.all([
    backend.listContainers(),
    backend.getStats(),
  ]);

  const probes = await Promise.all(
    [...registry.values()].map(async (def) => {
      const container = containers.get(`mc-${def.name}`);
      const state = deriveState(container);
      let ping = null as Awaited<ReturnType<typeof probePlayers>>["ping"];
      if (container?.state === "running" && container.health !== "unhealthy") {
        try {
          const probe = await probePlayers(def);
          ping = probe.ping;
        } catch (err) {
          console.error(`[panel] probe ${def.name} failed:`, err);
          ping = null;
        }
      }
      return { def, container, state, ping };
    }),
  );

  const router = getRouterConfig();

  const servers: ServerStatus[] = probes.map(
    ({ def, container, state, ping }) => {
      const statsInfo: ContainerStats | undefined = stats.get(`mc-${def.name}`);
      const healthyPing = state === "running" && ping && ping.latencyMs != null;
      return {
        name: def.name,
        title: def.title,
        platform: def.platform,
        mcVersion: def.mcVersion,
        memory: def.memory,
        connect: def.connect,
        rconPort: def.rconPort,
        maxPlayers: def.maxPlayers,
        description: def.description,
        tags: def.tags,
        modUrl: def.modUrl,
        custom: def.source === "custom",
        state,
        statusText: container?.statusText ?? "",
        health: container?.health ?? null,
        uptimeSec: container?.uptimeSec ?? null,
        players: ping
          ? {
              online: ping.playersOnline,
              max: ping.playersMax || def.maxPlayers,
              names: ping.playerSample,
            }
          : null,
        pingMs: healthyPing ? ping.latencyMs : null,
        motd: ping?.motd ?? null,
        favicon: ping?.favicon ?? null,
        versionName: ping?.versionName ?? null,
        cpuPerc:
          container?.state === "running" ? (statsInfo?.cpuPerc ?? null) : null,
        memUsed:
          container?.state === "running" ? (statsInfo?.memUsed ?? null) : null,
        memLimit:
          container?.state === "running" ? (statsInfo?.memLimit ?? null) : null,
        memPerc:
          container?.state === "running" ? (statsInfo?.memPerc ?? null) : null,
      };
    },
  );

  const summary: StatusSummary = {
    total: servers.length,
    running: servers.filter(
      (s) => s.state === "running" || s.state === "starting",
    ).length,
    stopped: servers.filter(
      (s) => s.state === "stopped" || s.state === "missing",
    ).length,
    unhealthy: servers.filter((s) => s.state === "unhealthy").length,
    playersOnline: servers.reduce(
      (acc, s) => acc + (s.players?.online ?? 0),
      0,
    ),
    playersMax: servers.reduce(
      (acc, s) => acc + (s.players?.max ?? s.maxPlayers),
      0,
    ),
  };

  const data: StatusResponse = {
    now: Date.now(),
    cached: false,
    router,
    servers,
    summary,
  };
  cache = { at: Date.now(), data };
  return data;
}
