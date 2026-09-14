// Kubernetes backend: the panel shells out to helm + kubectl the same way the
// Docker runtime shells out to the repo scripts + docker CLI. Each server is
// a Helm release (mc-<server>) of charts/minecraft-server in the panel's
// namespace; start = release with replicaCount=1, stop = same release scaled
// to 0 (data, route annotations and config stay in place).
//
// This file is the public facade; the implementation lives in lib/k8s/*:
//   kubectl.ts  shared exec plumbing      helm.ts       release management
//   workload.ts deployment state + stats logs.ts       logs & version
//   jobs.ts     one-off backup Jobs       backups.ts    backup listing/download
//   actions.ts  lifecycle actions
export { listContainers, getStats } from "@/lib/k8s/workload.js";
export { getRecentLogs, logFollow, getVersion } from "@/lib/k8s/logs.js";
export { listBackups, spawnBackupDownload } from "@/lib/k8s/backups.js";
export { runAction, type ActionResult } from "@/lib/k8s/actions.js";
