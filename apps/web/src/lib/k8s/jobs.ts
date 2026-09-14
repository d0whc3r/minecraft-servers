// One-off Jobs mounting the server's data/backups claims (backup, restore,
// backup listing when the server pod is not running).
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { releaseName } from "@/lib/runtime.js";
import { exec, JOB_IMAGE, KUBECTL_TIMEOUT_MS, ns } from "@/lib/k8s/kubectl.js";

/** Valid tarball name inside /backups (blocks path traversal). */
export function safeBackupName(name: string): string | null {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) && !name.includes("..")
    ? name
    : null;
}

export async function runJob(
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
export async function jobScript(name: string): Promise<string> {
  // Same env fallback chain as serverChartPath(): explicit override first,
  // MCPANEL_ROOT inside the image, cwd in dev. Resolved here instead of
  // importing servers.ts to keep this module importable in tests.
  const dir =
    (process.env.MCPANEL_JOBS_DIR ||
      process.env.MCPANEL_ROOT ||
      process.cwd()) + "/scripts/k8s-jobs";
  return fs.readFile(path.join(dir, `${name}.sh`), "utf8");
}
