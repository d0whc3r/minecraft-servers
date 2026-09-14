// System tab: live host resources (memory, disk, CPU, environment).
import { useEffect, useState } from "react";
import type { SystemInfo } from "@/types";
import { api, formatBytes, formatUptime, startPolling } from "@/lib/client";
import { cn, Meter, MONO } from "@/components/ui";

export function SystemTab() {
  const [info, setInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    return startPolling(async () => {
      try {
        setInfo(await api<SystemInfo>("/api/system"));
      } catch {
        /* transient */
      }
    }, 5000);
  }, []);

  if (!info)
    return (
      <p className="p-8 text-center text-dim">Reading host information…</p>
    );

  const memUsed = info.memTotalBytes - info.memFreeBytes;
  const diskUsed = info.diskTotalBytes - info.diskFreeBytes;
  const pct = (a: number, b: number) =>
    b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0;

  return (
    <>
      <div className="mb-5">
        <h2 className="m-0 text-[1.1rem] font-bold tracking-[-0.02em]">
          Host resources
        </h2>
        <p className="mt-1 mb-0 text-[0.84rem] text-dim">
          Live capacity and runtime information for this machine.
        </p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
        <div className="flex min-h-40 flex-col gap-3 rounded-2xl border border-edge bg-panel px-5 py-5">
          <h3 className="m-0 text-[0.95rem] font-bold">Memory</h3>
          <p className={cn("m-0", MONO)}>
            {formatBytes(memUsed)} / {formatBytes(info.memTotalBytes)} (
            {pct(memUsed, info.memTotalBytes)}%)
          </p>
          <Meter value={pct(memUsed, info.memTotalBytes)} />
        </div>
        <div className="flex min-h-40 flex-col gap-3 rounded-2xl border border-edge bg-panel px-5 py-5">
          <h3 className="m-0 text-[0.95rem] font-bold">Disk (project data)</h3>
          <p className={cn("m-0", MONO)}>
            {formatBytes(diskUsed)} / {formatBytes(info.diskTotalBytes)} (
            {pct(diskUsed, info.diskTotalBytes)}%)
          </p>
          <Meter value={pct(diskUsed, info.diskTotalBytes)} />
        </div>
        <div className="flex min-h-40 flex-col gap-3 rounded-2xl border border-edge bg-panel px-5 py-5">
          <h3 className="m-0 text-[0.95rem] font-bold">CPU</h3>
          <p className="m-0">{info.cpuCount} cores</p>
          <p className={cn("m-0 text-sm", MONO)}>{info.cpuModel}</p>
          <p className={cn("m-0", MONO)}>
            load: {info.loadAvg.map((l) => l.toFixed(2)).join(" · ")}
          </p>
        </div>
        <div className="flex min-h-40 flex-col gap-3 rounded-2xl border border-edge bg-panel px-5 py-5">
          <h3 className="m-0 text-[0.95rem] font-bold">Environment</h3>
          <p className={cn("m-0 text-sm", MONO)}>
            {info.hostname} · {info.platform}/{info.arch}
            <br />
            Docker {info.dockerVersion ?? "unavailable"} · Node{" "}
            {info.nodeVersion}
            <br />
            host uptime {formatUptime(info.hostUptimeSec)}
          </p>
        </div>
      </div>
    </>
  );
}
