// Backend selection: MCPANEL_RUNTIME=kubernetes swaps every operation to the
// helm/kubectl implementation, and the docker adapter is responsible for the
// "mc-" container-name prefix. The selection happens once at import time, so
// the k8s branch is loaded through a fresh module graph with the env set.
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dockerStopped: vi.fn(),
  dockerList: vi.fn(),
  dockerStats: vi.fn(),
  dockerLogs: vi.fn(),
  dockerVersion: vi.fn(),
  k8sStopped: vi.fn(),
  k8sList: vi.fn(),
  k8sStats: vi.fn(),
  k8sLogs: vi.fn(),
  k8sFollow: vi.fn(),
  k8sVersion: vi.fn(),
}));

vi.mock("@/lib/docker.js", () => ({
  isServerStopped: mocks.dockerStopped,
  listContainers: mocks.dockerList,
  getStats: mocks.dockerStats,
  getRecentLogs: mocks.dockerLogs,
  getDockerVersion: mocks.dockerVersion,
}));
vi.mock("@/lib/k8s.js", () => ({
  listContainers: mocks.k8sList,
  getStats: mocks.k8sStats,
  getRecentLogs: mocks.k8sLogs,
  logFollow: mocks.k8sFollow,
  getVersion: mocks.k8sVersion,
  runAction: vi.fn(),
}));
vi.mock("@/lib/k8sLifecycle.js", () => ({
  isServerStopped: mocks.k8sStopped,
}));

import { backend } from "@/lib/backend.js";

afterEach(() => {
  delete process.env.MCPANEL_RUNTIME;
});

describe("docker runtime (default)", () => {
  it("wires every operation to the docker module", async () => {
    mocks.dockerStopped.mockResolvedValue(true);
    mocks.dockerList.mockResolvedValue(new Map());
    mocks.dockerStats.mockResolvedValue(new Map());
    mocks.dockerVersion.mockResolvedValue("27.1.1");

    await expect(backend.isServerStopped("vanilla")).resolves.toBe(true);
    await backend.listContainers();
    await backend.getStats();
    await expect(backend.getVersion()).resolves.toBe("27.1.1");

    expect(mocks.dockerStopped).toHaveBeenCalledWith("vanilla");
    expect(mocks.dockerList).toHaveBeenCalled();
    expect(mocks.dockerStats).toHaveBeenCalled();
    expect(mocks.dockerVersion).toHaveBeenCalled();
  });

  it("adds the mc- container prefix for logs and the follow command", async () => {
    await backend.getRecentLogs("vanilla", 100);
    expect(mocks.dockerLogs).toHaveBeenCalledWith("mc-vanilla", 100);
    expect(backend.logFollow("vanilla")).toEqual({
      cmd: "docker",
      args: ["logs", "--tail", "200", "-f", "mc-vanilla"],
    });
  });
});

describe("kubernetes runtime", () => {
  it("wires every operation to the k8s module, which takes bare server names", async () => {
    process.env.MCPANEL_RUNTIME = "kubernetes";
    vi.resetModules();
    const { backend: k8sBackend } = await import("@/lib/backend.js");

    mocks.k8sStopped.mockResolvedValue(true);
    mocks.k8sList.mockResolvedValue(new Map());
    mocks.k8sStats.mockResolvedValue(new Map());
    mocks.k8sLogs.mockResolvedValue("log line");
    mocks.k8sVersion.mockResolvedValue("v1.30.4");

    await expect(k8sBackend.isServerStopped("vanilla")).resolves.toBe(true);
    await k8sBackend.listContainers();
    await k8sBackend.getStats();
    await expect(k8sBackend.getRecentLogs("vanilla", 100)).resolves.toBe(
      "log line",
    );
    await expect(k8sBackend.getVersion()).resolves.toBe("v1.30.4");
    k8sBackend.logFollow("vanilla");

    expect(mocks.k8sStopped).toHaveBeenCalledWith("vanilla");
    expect(mocks.k8sLogs).toHaveBeenCalledWith("vanilla", 100);
    expect(mocks.k8sFollow).toHaveBeenCalledWith("vanilla");
    expect(mocks.k8sVersion).toHaveBeenCalled();
    // No docker call may leak into the kubernetes runtime.
    expect(mocks.dockerStopped).not.toHaveBeenCalled();
    expect(mocks.dockerLogs).not.toHaveBeenCalled();
  });
});
