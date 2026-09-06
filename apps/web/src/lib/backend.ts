// Backend selection: the panel calls one of two interchangeable backends for
// status, stats, logs and versions. Actions (start/stop/...) go through
// actions.ts, which keeps its locking either way.
import { RUNTIME } from "@/lib/runtime.js";
import {
  listContainers,
  getStats,
  getRecentLogs,
  getDockerVersion,
  isServerStopped,
} from "@/lib/docker.js";
import { isServerStopped as k8sIsServerStopped } from "@/lib/k8sLifecycle.js";
import {
  listContainers as k8sListContainers,
  getStats as k8sGetStats,
  getRecentLogs as k8sGetRecentLogs,
  getVersion as k8sGetVersion,
  logFollow as k8sLogFollow,
} from "@/lib/k8s.js";

export interface Backend {
  /** Fresh check for registry removal. Throws if workload state is unavailable. */
  isServerStopped(server: string): Promise<boolean>;
  /** Workload state keyed by "mc-<server>". */
  listContainers(): Promise<
    Map<string, import("@/lib/docker.js").ContainerInfo>
  >;
  getStats(): Promise<Map<string, import("@/lib/docker.js").ContainerStats>>;
  /** Recent log lines for a server ("vanilla"), no "mc-" prefix. */
  getRecentLogs(server: string, tail: number): Promise<string>;
  /** Long-running log follow command for the SSE stream. */
  logFollow(server: string): { cmd: string; args: string[] };
  /** Engine/cluster version string for the admin panel, or null. */
  getVersion(): Promise<string | null>;
}

const dockerBackend: Backend = {
  isServerStopped,
  listContainers,
  getStats,
  getRecentLogs: (server, tail) => getRecentLogs(`mc-${server}`, tail),
  logFollow: (server) => ({
    cmd: "docker",
    args: ["logs", "--tail", "200", "-f", `mc-${server}`],
  }),
  getVersion: getDockerVersion,
};

const kubernetesBackend: Backend = {
  isServerStopped: k8sIsServerStopped,
  listContainers: k8sListContainers,
  getStats: k8sGetStats,
  getRecentLogs: k8sGetRecentLogs,
  logFollow: k8sLogFollow,
  getVersion: k8sGetVersion,
};

export const backend: Backend =
  RUNTIME === "kubernetes" ? kubernetesBackend : dockerBackend;
