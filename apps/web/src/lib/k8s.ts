// Kubernetes backend: the panel shells out to helm + kubectl the same way the
// Docker runtime shells out to the repo scripts + docker CLI. Each server is
// a Helm release (mc-<server>) of charts/minecraft-server in the panel's
// namespace; start = release with replicaCount=1, stop = same release scaled
// to 0 (data, route annotations and config stay in place).
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getServerDef, type ServerDef } from "@/lib/servers.js";
import { k8sNamespace, releaseName } from "@/lib/runtime.js";
import { buildServerValues, serverChartPath } from "@/lib/k8sValues.js";
import type { BackupFile } from "@/types.js";
import type { ContainerInfo, ContainerStats } from "@/lib/docker.js";

const exec = promisify(execFile);

const KUBECTL_TIMEOUT_MS = 20_000;
// Matches the docker runtime's action budgets (actions.ts) and the backup
// script's generous tar time for big worlds.
const BACKUP_TIMEOUT_MS = 30 * 60_000;

const PART_OF_LABEL = "app.kubernetes.io/part-of=minecraft-servers";

// alpine only to run tar/sha256sum inside one-off backup/restore Jobs.
const JOB_IMAGE = process.env.MCPANEL_K8S_JOB_IMAGE || "alpine:3.20";

/** Same set as actions.ts ActionType; duplicated to avoid an import cycle. */
type K8sAction = "start" | "stop" | "restart" | "backup" | "restore";

export interface ActionResult {
  ok: boolean;
  action: K8sAction;
  server: string;
  output: string;
  durationMs: number;
}

function ns(): string {
  return k8sNamespace();
}

// ---------------------------------------------------------------------------
// helm release management
// ---------------------------------------------------------------------------

async function writeValuesFile(def: ServerDef, replicas: number) {
  const file = path.join(
    os.tmpdir(),
    `mcpanel-values-${def.name}-${process.pid}-${Date.now()}.yaml`,
  );
  await fs.writeFile(
    file,
    // JSON is valid YAML; immune to quoting issues with CurseForge keys etc.
    JSON.stringify(buildServerValues(def, replicas), null, 2),
  );
  return file;
}

async function helmUpgrade(def: ServerDef, replicas: number): Promise<string> {
  const file = await writeValuesFile(def, replicas);
  try {
    const { stdout } = await exec(
      "helm",
      [
        "upgrade",
        releaseName(def.name),
        serverChartPath(),
        "--install",
        "--namespace",
        ns(),
        "--values",
        file,
        "--history-max",
        "5",
        "--set",
        `replicaCount=${replicas}`,
      ],
      { timeout: 4 * 60_000, maxBuffer: 4 * 1024 * 1024 },
    );
    return stdout.trim();
  } catch (err) {
    throw new Error(`helm upgrade failed: ${(err as Error).message}`);
  } finally {
    await fs.rm(file, { force: true }).catch(() => undefined);
  }
}

interface DeploymentInfo {
  replicas: number;
  ready: number;
  creation: string;
  readySince: string | null;
  limits: { cpu: string | null; memory: string | null };
}

async function getDeployment(server: string): Promise<DeploymentInfo | null> {
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

// ---------------------------------------------------------------------------
// status: drop-in equivalents of the docker helpers
// ---------------------------------------------------------------------------

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

export async function getRecentLogs(
  server: string,
  tail: number,
): Promise<string> {
  try {
    const { stdout } = await exec(
      "kubectl",
      [
        "logs",
        `deployment/${releaseName(server)}`,
        "--container",
        "minecraft",
        "--namespace",
        ns(),
        `--tail=${tail}`,
      ],
      { timeout: KUBECTL_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
    );
    return stdout;
  } catch (err) {
    return `kubectl logs failed: ${(err as Error).message}`;
  }
}

export function logFollow(server: string): {
  cmd: string;
  args: string[];
} {
  return {
    cmd: "kubectl",
    args: [
      "logs",
      `deployment/${releaseName(server)}`,
      "--container",
      "minecraft",
      "--namespace",
      ns(),
      "--tail=200",
      "--follow",
      "--pod-running-timeout=60s",
    ],
  };
}

export async function getVersion(): Promise<string | null> {
  try {
    const { stdout } = await exec("kubectl", ["version", "--output", "json"], {
      timeout: KUBECTL_TIMEOUT_MS,
    });
    const v = JSON.parse(stdout) as {
      serverVersion?: { gitVersion?: string };
    };
    return v.serverVersion?.gitVersion ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// backups: one-off Jobs mounting the server's data/backups claims
// ---------------------------------------------------------------------------

function safeBackupName(name: string): string | null {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) && !name.includes("..")
    ? name
    : null;
}

async function runJob(
  name: string,
  server: string,
  script: string,
  timeoutMs: number,
  args: string[] = [],
): Promise<string> {
  const job = {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: {
      name,
      namespace: ns(),
      labels: {
        "app.kubernetes.io/part-of": "minecraft-servers",
        "app.kubernetes.io/managed-by": "minecraft-panel",
      },
    },
    spec: {
      backoffLimit: 0,
      activeDeadlineSeconds: Math.ceil(timeoutMs / 1000) + 60,
      ttlSecondsAfterFinished: 600,
      template: {
        metadata: {
          labels: { "app.kubernetes.io/part-of": "minecraft-servers" },
        },
        spec: {
          restartPolicy: "Never",
          containers: [
            {
              name: "job",
              image: JOB_IMAGE,
              // argv tail: "job" is $0; args are positional parameters of the
              // script, so no shell quoting of user data happens in TS.
              command: ["/bin/sh", "-ec", script, "job", ...args],
              volumeMounts: [
                { name: "data", mountPath: "/data" },
                { name: "backups", mountPath: "/backups" },
              ],
            },
          ],
          volumes: [
            {
              name: "data",
              persistentVolumeClaim: {
                claimName: `${releaseName(server)}-data`,
              },
            },
            {
              name: "backups",
              persistentVolumeClaim: {
                claimName: `${releaseName(server)}-backups`,
              },
            },
          ],
        },
      },
    },
  };

  // A previous run with the same name should be gone already (TTL), but a
  // leftover must not block the new one.
  await exec(
    "kubectl",
    ["delete", "job", name, "--namespace", ns(), "--ignore-not-found"],
    { timeout: KUBECTL_TIMEOUT_MS },
  ).catch(() => undefined);

  const manifest = path.join(os.tmpdir(), `mcpanel-job-${name}.json`);
  await fs.writeFile(manifest, JSON.stringify(job));
  try {
    await exec(
      "kubectl",
      ["apply", "--namespace", ns(), "--filename", manifest],
      { timeout: KUBECTL_TIMEOUT_MS },
    );
  } catch (err) {
    throw new Error(`kubectl apply failed: ${(err as Error).message}`);
  } finally {
    await fs.rm(manifest, { force: true }).catch(() => undefined);
  }

  return waitForJob(name, timeoutMs);
}

async function jobLogs(name: string): Promise<string> {
  try {
    const { stdout } = await exec(
      "kubectl",
      ["logs", `job/${name}`, "--namespace", ns()],
      { timeout: KUBECTL_TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024 },
    );
    return stdout.trim() || "(no job output)";
  } catch (err) {
    return `could not read job logs: ${(err as Error).message}`;
  }
}

async function waitForJob(name: string, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs + 90_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2_500));
    try {
      const { stdout } = await exec(
        "kubectl",
        ["get", "job", name, "--namespace", ns(), "--output", "json"],
        { timeout: KUBECTL_TIMEOUT_MS },
      );
      const job = JSON.parse(stdout) as {
        status?: { succeeded?: number; failed?: number };
      };
      if ((job.status?.succeeded ?? 0) >= 1) return jobLogs(name);
      if ((job.status?.failed ?? 0) >= 1) {
        throw new Error(`Backup job failed:\n${await jobLogs(name)}`);
      }
    } catch (err) {
      if ((err as Error).message.includes("Backup job failed")) throw err;
      // job object not created yet / transient API hiccup: keep polling
    }
  }
  throw new Error(`Job ${name} did not finish within the time limit`);
}

/** Job scripts: POSIX sh files shipped with the panel (baked into the image
 *  at /repo/scripts/k8s-jobs by the Dockerfile) and executed either via
 *  `kubectl exec … /bin/sh -c` or as one-off Jobs with the script as argv, so
 *  arguments arrive as positional parameters instead of interpolated text. */
async function jobScript(name: string): Promise<string> {
  // Same env fallback chain as serverChartPath(): explicit override first,
  // MCPANEL_ROOT inside the image, cwd in dev. Resolved here instead of
  // importing servers.ts to keep this module importable in tests.
  const dir =
    (process.env.MCPANEL_JOBS_DIR ||
      process.env.MCPANEL_ROOT ||
      process.cwd()) + "/scripts/k8s-jobs";
  return fs.readFile(path.join(dir, `${name}.sh`), "utf8");
}

export async function listBackups(server: string): Promise<BackupFile[]> {
  const files: BackupFile[] = [];
  let out = "";
  const release = releaseName(server);
  const script = await jobScript("backup-list");
  try {
    // cheap path: exec into the running server pod
    const res = await exec(
      "kubectl",
      [
        "exec",
        "--namespace",
        ns(),
        `deployment/${release}`,
        "--container",
        "minecraft",
        "--",
        "/bin/sh",
        "-c",
        script,
      ],
      { timeout: KUBECTL_TIMEOUT_MS },
    );
    out = res.stdout;
  } catch {
    // server stopped: fall back to a short-lived Job that mounts the claims
    out = await runJob(
      `mc-${server}-backup-list-${Date.now().toString(36)}`,
      server,
      script,
      3 * 60_000,
    );
  }
  for (const line of out.split("\n")) {
    const [file, size, modified, checksum] = line.trim().split(/\s+/);
    if (
      !file ||
      !file.endsWith(".tar.gz") ||
      !size ||
      Number.isNaN(Number(size))
    )
      continue;
    files.push({
      file,
      sizeBytes: Number(size),
      modified: modified ?? "unknown",
      hasChecksum: checksum === "yes",
    });
  }
  files.sort((a, b) => b.modified.localeCompare(a.modified));
  return files;
}

export function spawnBackupDownload(
  server: string,
  name: string,
): { cmd: string; args: string[] } | null {
  const file = safeBackupName(name);
  if (!file) return null;
  return {
    cmd: "kubectl",
    args: [
      "exec",
      "--namespace",
      ns(),
      `deployment/${releaseName(server)}`,
      "--container",
      "minecraft",
      "--",
      "cat",
      `/backups/${file}`,
    ],
  };
}

async function waitForScaleZero(server: string): Promise<void> {
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    const dep = await getDeployment(server);
    if (!dep || (dep.replicas === 0 && dep.ready === 0)) return;
    await new Promise((r) => setTimeout(r, 3_000));
  }
  throw new Error("Server did not scale to 0 in time for the restore");
}

// ---------------------------------------------------------------------------
// actions (same contract as the bash-script actions)
// ---------------------------------------------------------------------------

export async function runAction(
  action: K8sAction,
  server: string,
  backupFile?: string,
): Promise<ActionResult> {
  const started = Date.now();
  const finish = (ok: boolean, output: string): ActionResult => ({
    ok,
    action,
    server,
    output,
    durationMs: Date.now() - started,
  });

  const def = getServerDef(server);
  if (!def) return finish(false, `Unknown server: ${server}`);
  const release = releaseName(server);

  try {
    if (action === "start") {
      const out = await helmUpgrade(def, 1);
      return finish(
        true,
        `Release ${release} deployed (replicaCount=1)\n${out}`,
      );
    }
    if (action === "stop") {
      const dep = await getDeployment(server);
      if (!dep) return finish(true, "Server is not deployed");
      const out = await helmUpgrade(def, 0);
      return finish(true, `Release ${release} scaled to 0\n${out}`);
    }
    if (action === "restart") {
      const dep = await getDeployment(server);
      if (!dep || dep.replicas === 0) {
        const out = await helmUpgrade(def, 1);
        return finish(
          true,
          `Release ${release} deployed (replicaCount=1)\n${out}`,
        );
      }
      await exec(
        "kubectl",
        ["rollout", "restart", `deployment/${release}`, "--namespace", ns()],
        { timeout: KUBECTL_TIMEOUT_MS },
      );
      return finish(true, `Rolling restart triggered for ${release}`);
    }
    if (action === "backup") {
      const stamp = new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d+Z$/, "Z");
      const file = `${server}-${stamp}.tar.gz`;
      const out = await runJob(
        `mc-${server}-backup-${Date.now().toString(36)}`,
        server,
        await jobScript("backup-create"),
        BACKUP_TIMEOUT_MS,
        [file],
      );
      return finish(true, out);
    }
    if (action === "restore") {
      const file = safeBackupName(backupFile ?? "");
      if (!file) return finish(false, "Invalid backup file");
      const dep = await getDeployment(server);
      if (dep && dep.replicas > 0) {
        await helmUpgrade(def, 0);
        await waitForScaleZero(server);
      }
      const out = await runJob(
        `mc-${server}-restore-${Date.now().toString(36)}`,
        server,
        await jobScript("backup-restore"),
        BACKUP_TIMEOUT_MS,
        [file],
      );
      return finish(true, `Server stopped; world restored.\n${out}`);
    }
    return finish(false, `Unknown action: ${action}`);
  } catch (err) {
    return finish(false, (err as Error).message);
  }
}
