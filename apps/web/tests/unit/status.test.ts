// Status aggregation: derives one snapshot per server from container state +
// game ping. The state matrix (container state/health/uptime → ServerState),
// the RCON fallback when the list ping fails, and the 3s snapshot cache are
// the behaviors the dashboard depends on; none of them are visible in the
// docker layer alone.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerRegistry: vi.fn(),
  getRouterConfig: vi.fn(),
  rconPassword: vi.fn(),
  listContainers: vi.fn(),
  getStats: vi.fn(),
  pingServer: vi.fn(),
  rconCommand: vi.fn(),
}));

vi.mock("@/lib/servers.js", () => ({
  getServerRegistry: mocks.getServerRegistry,
  getRouterConfig: mocks.getRouterConfig,
  rconPassword: mocks.rconPassword,
}));
vi.mock("@/lib/backend.js", () => ({
  backend: { listContainers: mocks.listContainers, getStats: mocks.getStats },
}));
vi.mock("@/lib/ping.js", () => ({ pingServer: mocks.pingServer }));
vi.mock("@/lib/rcon.js", () => ({ rconCommand: mocks.rconCommand }));

import { buildStatus } from "@/lib/status.js";
import type { ServerDef } from "@/lib/servers.js";
import type { ContainerInfo } from "@/lib/docker.js";

const ROUTER = { host: "router.test", domain: "mc.test", port: 25565 };

function def(name: string, overrides: Partial<ServerDef> = {}): ServerDef {
  return {
    name,
    title: name.toUpperCase(),
    platform: "Paper",
    mcVersion: "1.21.1",
    memory: "2G",
    type: "PAPER",
    connect: `${name}.mc.test`,
    rconPort: 26565,
    rconHost: "127.0.0.1",
    maxPlayers: 20,
    description: "",
    tags: [],
    modUrl: null,
    source: "catalog",
    env: { RCON_PASSWORD: "secret" },
    ...overrides,
  };
}

function container(overrides: Partial<ContainerInfo> = {}): ContainerInfo {
  return {
    name: "mc-solo",
    state: "running",
    statusText: "Up 10 minutes",
    health: "healthy",
    uptimeSec: 600,
    ...overrides,
  };
}

/** Registry with exactly one server, so each case asserts a single mapping. */
function soloScenario(defOverrides: Partial<ServerDef> = {}) {
  mocks.getServerRegistry.mockReturnValue(
    new Map([[def("solo", defOverrides).name, def("solo", defOverrides)]]),
  );
}

function containers(...infos: Array<ContainerInfo | undefined>) {
  const map = new Map<string, ContainerInfo>();
  for (const info of infos) {
    if (info) map.set(info.name, info);
  }
  mocks.listContainers.mockResolvedValue(map);
}

// The module caches its snapshot for 3s across calls; every test gets its own
// minute on the fake clock so a snapshot cached by an earlier test can never
// be fresh again (tests run in under a millisecond, so a fixed offset shared
// by all tests would collide).
let clockTick = 0;

beforeEach(() => {
  clockTick += 1;
  vi.useFakeTimers({ now: new Date(Date.UTC(2026, 0, 1, 0, clockTick)) });
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getRouterConfig.mockReturnValue(ROUTER);
  mocks.rconPassword.mockImplementation((d: ServerDef) => d.env.RCON_PASSWORD);
  mocks.getStats.mockResolvedValue(new Map());
  mocks.pingServer.mockResolvedValue(null);
  mocks.rconCommand.mockResolvedValue({ ok: false, output: "" });
  containers(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("state derivation", () => {
  it.each([
    ["no container registered", undefined, "missing"],
    ["restarting container", container({ state: "restarting" }), "starting"],
    ["paused container", container({ state: "paused" }), "stopped"],
    ["exited container", container({ state: "exited" }), "stopped"],
    ["unhealthy container", container({ health: "unhealthy" }), "unhealthy"],
    ["health check starting", container({ health: "starting" }), "starting"],
    [
      "running under the 5-minute warmup",
      { ...container(), uptimeSec: 299 },
      "starting",
    ],
    [
      "running past the 5-minute warmup",
      { ...container(), uptimeSec: 300 },
      "running",
    ],
    [
      "fresh container without a healthcheck",
      container({ health: null, uptimeSec: 5 }),
      "starting",
    ],
  ] as Array<[string, ContainerInfo | undefined, string]>)(
    "%s → %s",
    async (_label, info, expected) => {
      soloScenario();
      containers(info);
      const data = await buildStatus();
      expect(data.servers[0].state).toBe(expected);
    },
  );

  it("keeps a stopped server's raw container text but no health-derived state", async () => {
    soloScenario();
    containers(container({ state: "exited", health: "healthy" }));
    const { servers } = await buildStatus();
    expect(servers[0].state).toBe("stopped");
    expect(servers[0].statusText).toBe("Up 10 minutes");
    expect(servers[0].health).toBe("healthy");
  });

  it("reports an empty statusText when docker knows nothing about the server", async () => {
    soloScenario();
    const data = await buildStatus();
    expect(data.servers[0].statusText).toBe("");
    expect(data.servers[0].uptimeSec).toBeNull();
  });
});

describe("player probes", () => {
  it("pings through the router using the server's connect name, only for live containers", async () => {
    soloScenario();
    containers(container());
    mocks.pingServer.mockResolvedValue({
      latencyMs: 20,
      motd: "hello",
      versionName: "1.21.1",
      playersOnline: 3,
      playersMax: 20,
      playerSample: ["a", "b", "c"],
      favicon: "img",
    });
    const { servers } = await buildStatus();
    expect(mocks.pingServer).toHaveBeenCalledWith(
      "router.test",
      25565,
      2500,
      "solo.mc.test",
    );
    expect(servers[0].players).toEqual({
      online: 3,
      max: 20,
      names: ["a", "b", "c"],
    });
    expect(servers[0].pingMs).toBe(20);
    expect(servers[0].motd).toBe("hello");
    expect(servers[0].favicon).toBe("img");
    expect(servers[0].versionName).toBe("1.21.1");
  });

  it("does not probe stopped, missing, restarting or unhealthy servers", async () => {
    soloScenario();
    containers(container({ state: "exited" }));
    await buildStatus();
    expect(mocks.pingServer).not.toHaveBeenCalled();
    containers(container({ health: "unhealthy" }));
    await buildStatus();
    expect(mocks.pingServer).not.toHaveBeenCalled();
    containers(container({ state: "restarting" }));
    await buildStatus();
    expect(mocks.pingServer).not.toHaveBeenCalled();
  });

  it("still probes during the warmup window so new servers show player counts", async () => {
    soloScenario();
    containers(container({ uptimeSec: 30 }));
    mocks.pingServer.mockResolvedValue({
      latencyMs: 15,
      motd: null,
      versionName: null,
      playersOnline: 0,
      playersMax: 20,
      playerSample: [],
      favicon: null,
    });
    const { servers } = await buildStatus();
    expect(mocks.pingServer).toHaveBeenCalled();
    expect(servers[0].state).toBe("starting");
    // A "starting" server is not acceptably pingable yet: latency is hidden
    // even though the probe succeeded.
    expect(servers[0].pingMs).toBeNull();
    expect(servers[0].players).toEqual({ online: 0, max: 20, names: [] });
  });

  it("falls back to RCON `list` when the ping fails", async () => {
    soloScenario({ rconPort: 26590, rconHost: "127.0.0.1" });
    containers(container());
    mocks.pingServer.mockResolvedValue(null);
    mocks.rconCommand.mockResolvedValue({
      ok: true,
      output: "There are 2 of a max of 20 players online: alice, bob",
    });
    const { servers } = await buildStatus();
    expect(mocks.rconCommand).toHaveBeenCalledWith(
      "127.0.0.1",
      26590,
      "secret",
      "list",
      3500,
    );
    expect(servers[0].players).toEqual({
      online: 2,
      max: 20,
      names: ["alice", "bob"],
    });
    // RCON carries no latency sample.
    expect(servers[0].pingMs).toBeNull();
  });

  it("parses the RCON list line even with an empty player sample", async () => {
    soloScenario();
    containers(container());
    mocks.rconCommand.mockResolvedValue({
      ok: true,
      output: "There are 0 of a max of 20 players online:",
    });
    const { servers } = await buildStatus();
    expect(servers[0].players).toEqual({ online: 0, max: 20, names: [] });
  });

  it("skips the RCON fallback without a port or password", async () => {
    soloScenario({ rconPort: null, env: {} });
    containers(container());
    await buildStatus();
    expect(mocks.rconCommand).not.toHaveBeenCalled();
  });

  it("survives a probe crash: the server shows no players instead of failing the panel", async () => {
    soloScenario();
    containers(container());
    mocks.pingServer.mockRejectedValue(new Error("connection refused"));
    const { servers } = await buildStatus();
    expect(servers[0].players).toBeNull();
    expect(servers[0].pingMs).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("resource stats", () => {
  it("attaches stats only to running containers", async () => {
    mocks.getServerRegistry.mockReturnValue(
      new Map([
        ["solo", def("solo")],
        ["exited", def("exited")],
      ]),
    );
    containers(container(), container({ name: "mc-exited", state: "exited" }));
    mocks.getStats.mockResolvedValue(
      new Map([
        [
          "mc-solo",
          { cpuPerc: 12.5, memUsed: "1GiB", memLimit: "2GiB", memPerc: 50 },
        ],
        [
          "mc-exited",
          { cpuPerc: 99, memUsed: "0B", memLimit: "2GiB", memPerc: 0 },
        ],
      ]),
    );
    const { servers } = await buildStatus();
    expect(servers[0].cpuPerc).toBe(12.5);
    expect(servers[0].memUsed).toBe("1GiB");
    // A stopped container's numbers are stale by definition.
    expect(servers[1].cpuPerc).toBeNull();
    expect(servers[1].memUsed).toBeNull();
  });
});

describe("summary", () => {
  it("aggregates the whole registry, counting starting as up and missing as down", async () => {
    mocks.getServerRegistry.mockReturnValue(
      new Map(
        [
          def("alpha", { maxPlayers: 30, source: "custom" }),
          def("beta"),
          def("gamma"),
          def("delta"),
          def("epsilon"),
          def("zeta"),
        ].map((d) => [d.name, d]),
      ),
    );
    containers(
      container({ name: "mc-alpha", uptimeSec: 400 }), // running
      container({ name: "mc-beta", uptimeSec: 10 }), // starting
      container({ name: "mc-gamma", health: "unhealthy" }),
      container({ name: "mc-delta", state: "exited" }),
      undefined, // epsilon missing
      container({ name: "mc-zeta", state: "restarting" }), // starting
    );
    mocks.pingServer.mockImplementation(async (_h, _p, _t, connect) => {
      if (connect === "alpha.mc.test")
        return {
          latencyMs: 20,
          motd: null,
          versionName: null,
          playersOnline: 3,
          playersMax: 0, // broken query response: falls back to the def
          playerSample: [],
          favicon: null,
        };
      return null; // beta's ping fails → RCON fallback below
    });
    mocks.rconCommand.mockResolvedValue({
      ok: true,
      output: "There are 2 of a max of 20 players online: alice, bob",
    });

    const data = await buildStatus();
    expect(data.summary).toEqual({
      total: 6,
      running: 3, // alpha + beta + zeta(starting)
      stopped: 2, // delta + epsilon(missing)
      unhealthy: 1,
      playersOnline: 5, // 3 (alpha ping) + 2 (beta RCON)
      // Capacity counts every server: alpha 30 (broken ping fell back to the
      // def's maxPlayers), beta 20 (RCON line) and 20 each for the four
      // servers that answered no probe at all.
      playersMax: 130,
    });
    const alpha = data.servers.find((s) => s.name === "alpha")!;
    expect(alpha.custom).toBe(true); // panel-created
    expect(alpha.players!.max).toBe(30);
  });
});

describe("3-second snapshot cache", () => {
  it("serves the previous snapshot instead of re-querying the backend", async () => {
    soloScenario();
    containers(container());
    const first = await buildStatus();
    expect(first.cached).toBe(false);

    vi.advanceTimersByTime(2000);
    const second = await buildStatus();
    expect(second.cached).toBe(true);
    expect(second.servers).toEqual(first.servers);
    expect(mocks.listContainers).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1001); // past the 3s TTL
    const third = await buildStatus();
    expect(third.cached).toBe(false);
    expect(mocks.listContainers).toHaveBeenCalledTimes(2);
  });
});
