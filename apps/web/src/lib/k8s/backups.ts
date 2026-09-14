// Backup listing/download against the cluster plus the scale-to-zero wait the
// restore flow needs before its Job may touch the world data.
import type { BackupFile } from "@/types.js";
import { releaseName } from "@/lib/runtime.js";
import { exec, KUBECTL_TIMEOUT_MS, ns } from "@/lib/k8s/kubectl.js";
import { getDeployment } from "@/lib/k8s/workload.js";
import { jobScript, runJob, safeBackupName } from "@/lib/k8s/jobs.js";

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

export async function waitForScaleZero(server: string): Promise<void> {
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    const dep = await getDeployment(server);
    if (!dep || (dep.replicas === 0 && dep.ready === 0)) return;
    await new Promise((r) => setTimeout(r, 3_000));
  }
  throw new Error("Server did not scale to 0 in time for the restore");
}
