// Pure builder: repo env config (config/modpacks/<server>.env + shared .env,
// already merged by the registry) -> values for the minecraft-server chart.
// The result is serialized as JSON, which is valid YAML, so helm accepts it
// via --values without any escaping surprises (CurseForge keys are full of
// shell-hostile characters).
import type { ServerDef } from "@/lib/servers.js";

export interface MinecraftChartValues {
  replicaCount: number;
  image: { repository: string; tag: string; pullPolicy: string };
  env: Record<string, string>;
  secretEnv: Record<string, string>;
  router: { host: string; default: boolean };
  resources?: {
    requests: { memory: string };
    limits: { memory: string };
  };
}

// Values with these key patterns go into the rendered Secret, not the
// ConfigMap (same masking rule the panel UI uses).
const SECRET_KEY = /PASSWORD|API_KEY|TOKEN|SECRET/i;

// Keys that only made sense on the docker host or that the chart passes as
// structured values instead (image tag, resources, router annotations, fixed
// ports): the chart wiring overrides them anyway.
const EXCLUDED_KEYS = new Set([
  "MEMORY",
  "JAVA_VERSION",
  "RCON_PORT",
  "SERVER_PORT",
  "MC_ROUTER_DOMAIN",
  "MC_ROUTER_DEFAULT",
  "SERVER_NAME",
]);

const TRUTHY = /^(true|1|yes|on)$/i;

/**
 * itzg memory syntax -> Kubernetes quantity: "6G" -> "6Gi", "512M" -> "512Mi",
 * plain "1024" is MB (itzg's default unit) -> "1024Mi". Returns null when the
 * value is absent/unparseable so the chart default applies.
 */
export function memoryToK8s(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = /^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)$/.exec(raw.trim());
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toUpperCase();
  if (unit === "" || unit === "M" || unit === "MB") return `${Math.round(n)}Mi`;
  if (unit === "G" || unit === "GB" || unit === "GI") return `${n}Gi`;
  if (unit === "MI") return `${n}Mi`;
  return null;
}

// Native JVM memory on top of the heap (metaspace, code cache, direct byte
// buffers, GC metadata): a pod limit equal to the heap OOMKills the server
// right when the heap fills up. At least 1Gi, or 25% of the heap when larger.
const LIMIT_OVERHEAD_MIB = 1024;

export function memoryLimitK8s(raw: string | undefined): string | null {
  const heap = memoryToK8s(raw);
  if (!heap) return null;
  const heapMib = Number(heap.slice(0, -2)) * (heap.endsWith("Gi") ? 1024 : 1);
  const limitMib =
    heapMib + Math.max(LIMIT_OVERHEAD_MIB, Math.round(heapMib / 4));
  return limitMib % 1024 === 0 ? `${limitMib / 1024}Gi` : `${limitMib}Mi`;
}

export function buildServerValues(
  def: ServerDef,
  replicas: number,
): MinecraftChartValues {
  const env: Record<string, string> = {};
  const secretEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(def.env)) {
    if (EXCLUDED_KEYS.has(key)) continue;
    (SECRET_KEY.test(key) ? secretEnv : env)[key] = value;
  }

  const values: MinecraftChartValues = {
    replicaCount: replicas,
    image: {
      repository: "itzg/minecraft-server",
      // JAVA_VERSION doubles as the image tag, like docker-compose does
      tag: def.env.JAVA_VERSION || "latest",
      pullPolicy: "IfNotPresent",
    },
    env,
    secretEnv,
    router: {
      host: def.connect,
      default: TRUTHY.test(def.env.MC_ROUTER_DEFAULT ?? ""),
    },
  };

  const memory = memoryToK8s(def.env.MEMORY);
  if (memory) {
    // Request keeps the heap (what the scheduler should reserve); the limit
    // adds native-JVM headroom so the container survives full-heap moments.
    values.resources = {
      requests: { memory },
      limits: { memory: memoryLimitK8s(def.env.MEMORY) ?? memory },
    };
  }
  return values;
}

/** Chart location inside the panel image / repo checkout. */
export function serverChartPath(): string {
  return (
    (process.env.MCPANEL_CHARTS_DIR ||
      // PROJECT_ROOT is not imported to keep this module pure for tests.
      process.env.MCPANEL_ROOT ||
      process.cwd()) + "/charts/minecraft-server"
  );
}
