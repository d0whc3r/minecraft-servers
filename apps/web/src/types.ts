// Shared types between the API layer and the React islands.

export type ServerState =
  "running" | "stopped" | "unhealthy" | "starting" | "missing";

export interface PlayerInfo {
  online: number;
  max: number;
  names: string[];
}

export interface ServerStatus {
  name: string;
  title: string;
  platform: string;
  mcVersion: string;
  memory: string;
  /** Player-facing route "<server>.<MC_ROUTER_DOMAIN>" via mc-router. */
  connect: string;
  rconPort: number | null;
  maxPlayers: number;
  description: string;
  /** Search/category tags (e.g. "skyblock", "rpg"); empty for untagged servers. */
  tags: string[];
  /** Official modpack page (CurseForge/Modrinth), null for plain server types. */
  modUrl: string | null;
  /** True when the panel created this server (it can be removed from the panel). */
  custom: boolean;
  // Live data
  state: ServerState;
  statusText: string;
  health: string | null;
  uptimeSec: number | null;
  players: PlayerInfo | null;
  pingMs: number | null;
  motd: string | null;
  favicon: string | null;
  versionName: string | null;
  cpuPerc: number | null;
  memUsed: string | null;
  memLimit: string | null;
  memPerc: number | null;
}

export interface StatusSummary {
  total: number;
  running: number;
  stopped: number;
  unhealthy: number;
  playersOnline: number;
  playersMax: number;
}

export interface StatusResponse {
  now: number;
  cached: boolean;
  /** Single entry point: players use "<server>.<domain>" on <port>. */
  router: { domain: string; port: number };
  servers: ServerStatus[];
  summary: StatusSummary;
}

export interface BackupFile {
  file: string;
  sizeBytes: number;
  modified: string;
  hasChecksum: boolean;
}

export interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  cpuModel: string;
  cpuCount: number;
  loadAvg: number[];
  memTotalBytes: number;
  memFreeBytes: number;
  hostUptimeSec: number;
  diskTotalBytes: number;
  diskFreeBytes: number;
  dockerVersion: string | null;
  nodeVersion: string;
}

export interface AuthMe {
  authed: boolean;
  user: string | null;
  publicView: boolean;
}
