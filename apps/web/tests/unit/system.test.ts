// Admin system panel: merges host facts (os), the engine version and a `df`
// parse of the project volume. The df parsing and its failure fallback are
// the only fragile parts — everything else is a straight os.* mapping.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exec: vi.fn(),
  getVersion: vi.fn(),
}));

vi.mock("node:child_process", async () => {
  const { promisify } = await import("node:util");
  return {
    execFile: Object.assign(vi.fn(), { [promisify.custom]: mocks.exec }),
  };
});
vi.mock("node:os", () => ({
  default: {
    hostname: () => "mc-host-01",
    platform: () => "linux",
    arch: () => "x64",
    cpus: () => [{ model: "  Common KVM processor  " }, { model: "second" }],
    loadavg: () => [0.1, 0.2, 0.3],
    totalmem: () => 16 * 1024 ** 3,
    freemem: () => 8 * 1024 ** 3,
    uptime: () => 1234.7,
  },
}));
vi.mock("@/lib/backend.js", () => ({
  backend: { getVersion: mocks.getVersion },
}));

import { getSystemInfo } from "@/lib/system.js";

beforeEach(() => {
  // `df -kP` output: header line + one line per mount; 1K blocks.
  mocks.exec.mockResolvedValue({
    stdout:
      "Filesystem     1024-blocks      Used Available Capacity Mounted on\n" +
      "/dev/sda1          82031488  4120576  73770192       6% /\n",
  });
  mocks.getVersion.mockResolvedValue("27.1.1");
});

describe("getSystemInfo", () => {
  it("merges host facts, the project volume's df line and the engine version", async () => {
    const info = await getSystemInfo();
    expect(info).toMatchObject({
      hostname: "mc-host-01",
      platform: "linux",
      arch: "x64",
      cpuModel: "Common KVM processor", // trimmed
      cpuCount: 2,
      loadAvg: [0.1, 0.2, 0.3],
      memTotalBytes: 16 * 1024 ** 3,
      memFreeBytes: 8 * 1024 ** 3,
      hostUptimeSec: 1234, // floored
      diskTotalBytes: 82031488 * 1024, // df reports 1K blocks
      diskFreeBytes: 73770192 * 1024,
      dockerVersion: "27.1.1",
      nodeVersion: process.version,
    });
    // The panel cares about the volume holding the project, not any mount.
    expect(mocks.exec).toHaveBeenCalledWith(
      "df",
      ["-kP", expect.stringContaining("minecraft-servers")],
      { timeout: 5000 },
    );
  });

  it("uses the last df line when several filesystems are listed", async () => {
    mocks.exec.mockResolvedValue({
      stdout: [
        "Filesystem 1024-blocks Used Available Capacity Mounted on",
        "/dev/sda1 100 10 90 10% /",
        "overlay 200 20 180 10% /apps/web/data",
      ].join("\n"),
    });
    const info = await getSystemInfo();
    expect(info.diskTotalBytes).toBe(200 * 1024);
    expect(info.diskFreeBytes).toBe(180 * 1024);
  });

  it("reports no disk when df fails (unsupported/unavailable)", async () => {
    mocks.exec.mockRejectedValue(new Error("exit 1"));
    const info = await getSystemInfo();
    expect(info.diskTotalBytes).toBe(0);
    expect(info.diskFreeBytes).toBe(0);
    // The rest of the panel data is still worth showing.
    expect(info.hostname).toBe("mc-host-01");
  });

  it("falls back to an unknown CPU model on an empty cpu list", async () => {
    const os = await import("node:os");
    vi.spyOn(os.default, "cpus").mockReturnValueOnce([]);
    const info = await getSystemInfo();
    expect(info.cpuModel).toBe("unknown");
    expect(info.cpuCount).toBe(0);
  });
});
