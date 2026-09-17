// Shared dashboard/admin filtering: the five server states must partition
// exactly into the running/stopped/alerts filter categories, and free-text
// search must cover every field the UI shows about a server.
import { describe, expect, it } from "vitest";
import type { ServerState, ServerStatus } from "@/types";
import {
  matchesServerQuery,
  matchesStateFilter,
  stateFilterCounts,
} from "@/lib/serverFilters";

function server(state: ServerState, overrides: Partial<ServerStatus> = {}) {
  return {
    name: "vanilla",
    title: "Vanilla",
    platform: "Paper",
    mcVersion: "1.21.1",
    memory: "2G",
    connect: "vanilla.mc.test",
    rconPort: 26565,
    maxPlayers: 20,
    description: "A plain survival server",
    tags: ["survival"],
    modUrl: null,
    custom: false,
    state,
    statusText: "",
    health: null,
    uptimeSec: null,
    players: null,
    pingMs: null,
    motd: null,
    favicon: null,
    versionName: null,
    cpuPerc: null,
    memUsed: null,
    memLimit: null,
    memPerc: null,
    ...overrides,
  } as ServerStatus;
}

describe("matchesStateFilter", () => {
  // The five states must land in exactly one category each; if a state ever
  // matched two filters (or none) the dashboard counts would double or drop.
  it.each([
    ["running", "running"],
    ["starting", "running"],
    ["stopped", "stopped"],
    ["missing", "stopped"],
    ["unhealthy", "alerts"],
  ] as Array<[ServerState, "running" | "stopped" | "alerts"]>)(
    "%s servers appear under the %s filter",
    (state, category) => {
      expect(matchesStateFilter(server(state), category)).toBe(true);
      for (const other of ["running", "stopped", "alerts"] as const) {
        if (other !== category) {
          expect(matchesStateFilter(server(state), other)).toBe(false);
        }
      }
    },
  );

  it("never filters anything out on 'all'", () => {
    for (const state of [
      "running",
      "starting",
      "stopped",
      "missing",
      "unhealthy",
    ] as ServerState[]) {
      expect(matchesStateFilter(server(state), "all")).toBe(true);
    }
  });
});

describe("stateFilterCounts", () => {
  it("partitions the list: running + stopped + alerts equals all", () => {
    const servers = [
      server("running"),
      server("starting"),
      server("stopped"),
      server("missing"),
      server("unhealthy"),
      server("running"),
    ];
    const counts = stateFilterCounts(servers);
    expect(counts).toEqual({ all: 6, running: 3, stopped: 2, alerts: 1 });
    expect(counts.running + counts.stopped + counts.alerts).toBe(counts.all);
  });

  it("counts an empty list as zero everywhere", () => {
    expect(stateFilterCounts([])).toEqual({
      all: 0,
      running: 0,
      stopped: 0,
      alerts: 0,
    });
  });
});

describe("matchesServerQuery", () => {
  it("matches any shown field: name, title, platform, version, description, tags", () => {
    const s = server("running", {
      name: "all-mods-10",
      title: "All the Mods 10",
      platform: "NeoForge",
      mcVersion: "1.21.1",
      description: "Kitchen sink pack",
      tags: ["skyblock", "rpg"],
    });
    for (const q of [
      "all-mods-10",
      "all the mods 10",
      "neoforge",
      "1.21.1",
      "kitchen sink",
      "skyblock",
    ]) {
      expect(matchesServerQuery(s, q), q).toBe(true);
    }
  });

  it("is case-insensitive and ignores surrounding whitespace", () => {
    const s = server("running", { tags: ["SkyBlock"] });
    expect(matchesServerQuery(s, "  SKYBLOCK  ")).toBe(true);
  });

  it("matches everything on an empty or blank query", () => {
    const s = server("running");
    expect(matchesServerQuery(s, "")).toBe(true);
    expect(matchesServerQuery(s, "   ")).toBe(true);
  });

  it("does not match fields the UI does not search", () => {
    // "connect"/"memory" hold hostnames and sizes; searching them would make
    // typing a version or an IP surface unrelated servers.
    const s = server("running", { memory: "2G", connect: "vanilla.mc.test" });
    expect(matchesServerQuery(s, "2G")).toBe(false);
    expect(matchesServerQuery(s, "mc.test")).toBe(false);
  });
});
