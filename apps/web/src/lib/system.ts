// Host system stats for the admin panel.
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PROJECT_ROOT } from "@/lib/servers.js";
import { backend } from "@/lib/backend.js";
import type { SystemInfo } from "@/types.js";

const exec = promisify(execFile);

async function diskUsage(
  dir: string,
): Promise<{ total: number; free: number }> {
  try {
    const { stdout } = await exec("df", ["-kP", dir], { timeout: 5000 });
    const lines = stdout.trim().split("\n");
    const parts = lines[lines.length - 1].split(/\s+/);
    return { total: Number(parts[1]) * 1024, free: Number(parts[3]) * 1024 };
  } catch {
    return { total: 0, free: 0 };
  }
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const [disk, engineVersion] = await Promise.all([
    diskUsage(PROJECT_ROOT),
    backend.getVersion(),
  ]);
  const cpus = os.cpus();
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpuModel: cpus[0]?.model?.trim() ?? "unknown",
    cpuCount: cpus.length,
    loadAvg: os.loadavg(),
    memTotalBytes: os.totalmem(),
    memFreeBytes: os.freemem(),
    hostUptimeSec: Math.floor(os.uptime()),
    diskTotalBytes: disk.total,
    diskFreeBytes: disk.free,
    dockerVersion: engineVersion,
    nodeVersion: process.version,
  };
}
