// Unit tests for the chart values builder (repo env config -> helm values).
import { describe, expect, it } from "vitest";
import { buildServerValues, memoryToK8s } from "@/lib/k8sValues.js";
import type { ServerDef } from "@/lib/servers.js";

function def(env: Record<string, string>): ServerDef {
  return {
    name: "vanilla",
    title: "Vanilla",
    platform: "Paper",
    mcVersion: "1.21.1",
    memory: env.MEMORY ?? "?",
    type: env.TYPE ?? "",
    connect: `vanilla.mc.test`,
    rconPort: 25575,
    rconHost: "mc-vanilla.default.svc.cluster.local",
    maxPlayers: 20,
    description: "",
    modUrl: null,
    env,
  };
}

describe("memoryToK8s", () => {
  it("maps itzg memory syntax to k8s quantities", () => {
    expect(memoryToK8s("6G")).toBe("6Gi");
    expect(memoryToK8s("2GB")).toBe("2Gi");
    expect(memoryToK8s("512M")).toBe("512Mi");
    expect(memoryToK8s("1024")).toBe("1024Mi"); // plain = MB in itzg land
  });

  it("returns null for absent or garbage values", () => {
    expect(memoryToK8s(undefined)).toBeNull();
    expect(memoryToK8s("")).toBeNull();
    expect(memoryToK8s("a lot")).toBeNull();
  });
});

describe("buildServerValues", () => {
  it("splits plain env from secrets and excludes docker-host-only keys", () => {
    const values = buildServerValues(
      def({
        EULA: "TRUE",
        TYPE: "PAPER",
        MEMORY: "6G",
        JAVA_VERSION: "java21",
        RCON_PORT: "26567",
        SERVER_PORT: "25565",
        MC_ROUTER_DOMAIN: "mc.test",
        SERVER_NAME: "vanilla",
        MC_ROUTER_DEFAULT: "false",
        RCON_PASSWORD: "hunter2",
        CF_API_KEY: "$2a$10$abc",
      }),
      1,
    );

    expect(values.env).toEqual({ EULA: "TRUE", TYPE: "PAPER" });
    expect(values.secretEnv).toEqual({
      RCON_PASSWORD: "hunter2",
      CF_API_KEY: "$2a$10$abc",
    });
    expect(values.image.tag).toBe("java21");
    expect(values.resources).toEqual({
      requests: { memory: "6Gi" },
      limits: { memory: "6Gi" },
    });
    expect(values.router).toEqual({ host: "vanilla.mc.test", default: false });
    expect(values.replicaCount).toBe(1);
  });

  it("marks the default route and honours replicaCount for stop", () => {
    const values = buildServerValues(
      def({ MC_ROUTER_DEFAULT: "true", MEMORY: "3G" }),
      0,
    );
    expect(values.router.default).toBe(true);
    expect(values.replicaCount).toBe(0);
  });

  it("omits resources when MEMORY is absent so chart defaults apply", () => {
    const values = buildServerValues(def({ TYPE: "PAPER" }), 1);
    expect(values.resources).toBeUndefined();
    expect(values.image.tag).toBe("latest");
  });

  it("treats empty env values as real values (docker env_file parity)", () => {
    const values = buildServerValues(def({ MODRINTH_MODPACK: "" }), 1);
    expect(values.env.MODRINTH_MODPACK).toBe("");
  });
});
