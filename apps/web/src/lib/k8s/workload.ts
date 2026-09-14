// Workload state: deployments of the panel's namespace mapped to the same
// ContainerInfo/ContainerStats shapes the docker runtime produces.
import type { ContainerInfo, ContainerStats } from "@/lib/docker.js";
import { releaseName } from "@/lib/runtime.js";
import {
  exec,
  KUBECTL_TIMEOUT_MS,
  ns,
  PART_OF_LABEL,
} from "@/lib/k8s/kubectl.js";

export interface DeploymentInfo {
  replicas: number;
  ready: number;
  creation: string;
  readySince: string | null;
  limits: { cpu: string | null; memory: string | null };
}

export async function getDeployment(
  server: string,
): Promise<DeploymentInfo | null> {
  try {
    const { stdout } = await exec(
      "kubectl",
      [
        "get",
        "deployment",
        releaseName(server),
        "--namespace",
        ns(),
        "--output",
        "json",
      ],
      { timeout: KUBECTL_TIMEOUT_MS },
    );
    const dep = JSON.parse(stdout) as {
      spec?: {
        replicas?: number;
        template?: {
          spec?: {
            containers?: Array<{
              resources?: { limits?: Record<string, string> };
            }>;
          };
        };
      };
      metadata?: { creationTimestamp?: string };
      status?: {
        readyReplicas?: number;
        conditions?: Array<{ type: string; lastTransitionTime?: string }>;
      };
    };
    const readySince =
      dep.status?.conditions?.find((c) => c.type === "Ready")
        ?.lastTransitionTime ?? null;
    const limits =
      dep.spec?.template?.spec?.containers?.[0]?.resources?.limits ?? {};
    return {
      replicas: dep.spec?.replicas ?? 1,
      ready: dep.status?.readyReplicas ?? 0,
      creation: dep.metadata?.creationTimestamp ?? new Date().toISOString(),
      readySince,
      limits: {
        cpu: limits.cpu ?? null,
        memory: limits.memory ?? null,
      },
    };
  } catch {
    return null; // not deployed
  }
}

export async function listContainers(): Promise<Map<string, ContainerInfo>> {
  const map = new Map<string, ContainerInfo>();
  let raw: string;
  try {
    const out = await exec(
      "kubectl",
      [
        "get",
        "deployments",
        "--namespace",
        ns(),
        "--selector",
        PART_OF_LABEL,
        "--output",
        "json",
      ],
      { timeout: KUBECTL_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
    );
    raw = out.stdout;
  } catch {
    return map; // cluster unreachable: panel shows everything stopped
  }
  const list = JSON.parse(raw) as {
    items?: Array<unknown>;
  };
  for (const entry of list.items ?? []) {
    // typed loosely on purpose: we only touch well-known fields
    const d = entry as {
      metadata?: { name?: string; creationTimestamp?: string };
      spec?: {
        replicas?: number;
        template?: {
          spec?: {
            containers?: Array<{
              resources?: { limits?: Record<string, string> };
            }>;
          };
        };
      };
      status?: {
        readyReplicas?: number;
        conditions?: Array<{ type: string; lastTransitionTime?: string }>;
      };
    };
    const name = d.metadata?.name;
    if (!name) continue;
    const desired = d.spec?.replicas ?? 1;
    const ready = d.status?.readyReplicas ?? 0;
    const readySince =
      d.status?.conditions?.find((c) => c.type === "Ready")
        ?.lastTransitionTime ?? null;
    const limits =
      d.spec?.template?.spec?.containers?.[0]?.resources?.limits ?? {};

    let info: ContainerInfo;
    if (desired === 0) {
      info = {
        name,
        state: "exited",
        statusText: "Stopped (scaled to 0)",
        health: null,
        uptimeSec: null,
      };
    } else if (ready >= desired) {
      const since = readySince ?? d.metadata?.creationTimestamp ?? null;
      info = {
        name,
        state: "running",
        statusText: `Ready ${ready}/${desired}`,
        health: "healthy",
        uptimeSec: since
          ? Math.max(0, (Date.now() - new Date(since).getTime()) / 1000)
          : null,
      };
    } else {
      info = {
        name,
        state: "running",
        statusText: `${ready}/${desired} ready`,
        health: "starting",
        uptimeSec: d.metadata?.creationTimestamp
          ? Math.max(
              0,
              (Date.now() - new Date(d.metadata.creationTimestamp).getTime()) /
                1000,
            )
          : null,
      };
    }
    // stash limits for getStats() (parsed straight from the same payload)
    limitsByDeployment.set(name, {
      cpu: limits.cpu ?? null,
      memory: limits.memory ?? null,
    });
    map.set(name, info);
  }
  return map;
}

const limitsByDeployment = new Map<
  string,
  { cpu: string | null; memory: string | null }
>();

function toBytes(quantity: string | null): number | null {
  if (!quantity) return null;
  const m = /^(\d+(?:\.\d+)?)\s*([KMGTP]i?)?$/i.exec(quantity.trim());
  if (!m) return null;
  const n = Number(m[1]);
  const u = (m[2] ?? "").toLowerCase();
  const mult: Record<string, number> = {
    "": 1,
    k: 1e3,
    ki: 1024,
    m: 1e6,
    mi: 1024 ** 2,
    g: 1e9,
    gi: 1024 ** 3,
    p: 1e15,
    pi: 1024 ** 5,
  };
  return n * (mult[u] ?? 1);
}

function humanBytes(quantity: string | null): string {
  const bytes = toBytes(quantity);
  if (bytes === null) return quantity ?? "?";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)}GiB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)}MiB`;
  return `${Math.round(bytes / 1024)}KiB`;
}

let statsCache: { at: number; data: Map<string, ContainerStats> } | null = null;

export async function getStats(): Promise<Map<string, ContainerStats>> {
  if (statsCache && Date.now() - statsCache.at < 4_000) return statsCache.data;
  const map = new Map<string, ContainerStats>();
  try {
    const { stdout } = await exec(
      "kubectl",
      [
        "top",
        "pods",
        "--namespace",
        ns(),
        "--selector",
        PART_OF_LABEL,
        "--no-headers",
      ],
      { timeout: KUBECTL_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
    );
    for (const line of stdout.split("\n")) {
      const [pod, cpu, mem] = line.trim().split(/\s+/);
      if (!pod || !cpu || !mem) continue;
      const limits = limitsByDeployment.get(pod) ?? {
        cpu: null,
        memory: null,
      };
      const cpuMillicores = parseFloat(cpu) || 0; // "123m" or "0.5"
      const memBytes = toBytes(mem) ?? 0;
      const memLimitBytes = toBytes(limits.memory);
      const cpuLimitM = limits.cpu
        ? parseFloat(limits.cpu) * (limits.cpu.includes("m") ? 1 : 1000)
        : null;
      map.set(pod, {
        cpuPerc:
          cpuLimitM && cpuLimitM > 0
            ? Math.min(100, (cpuMillicores / cpuLimitM) * 100)
            : 0,
        memUsed: humanBytes(mem),
        memLimit: humanBytes(limits.memory),
        memPerc:
          memLimitBytes && memLimitBytes > 0
            ? Math.min(100, (memBytes / memLimitBytes) * 100)
            : 0,
      });
    }
  } catch {
    // metrics-server missing or cluster busy: cards just skip the usage bars
  }
  statsCache = { at: Date.now(), data: map };
  return map;
}
