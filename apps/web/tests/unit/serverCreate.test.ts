// Unit tests for live server creation/deletion from the panel, using an
// isolated MCPANEL_ROOT (repo catalog fixture) + MCPANEL_DATA_DIR fixture.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let root: string;
let data: string;

function write(rel: string, content: string) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

beforeEach(() => {
  vi.resetModules();
  delete process.env.MCPANEL_RUNTIME;
  root = fs.mkdtempSync(path.join(os.tmpdir(), "mcpanel-root-"));
  data = fs.mkdtempSync(path.join(os.tmpdir(), "mcpanel-data-"));
  process.env.MCPANEL_ROOT = root;
  process.env.MCPANEL_DATA_DIR = data;

  write(
    ".env",
    [
      "EULA=TRUE",
      "RCON_PASSWORD=shared-secret",
      "MC_ROUTER_DOMAIN=mc.test",
    ].join("\n"),
  );
  write(
    "config/modpacks/vanilla.env",
    ["TYPE=PAPER", "VERSION=1.21.1", "MEMORY=2G", "RCON_PORT=26565"].join("\n"),
  );
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(data, { recursive: true, force: true });
});

async function load() {
  const [servers, serverCreate] = await Promise.all([
    import("@/lib/servers"),
    import("@/lib/serverCreate"),
  ]);
  return { servers, serverCreate };
}

describe("createServer (docker runtime)", () => {
  it("writes a panel-managed env file into the repo catalog", async () => {
    const { servers, serverCreate } = await load();
    const result = serverCreate.createServer({
      name: "my-server",
      type: "paper",
      version: "1.21.4",
      memory: "6G",
      maxPlayers: 30,
      motd: "hello world",
    });

    const file = path.join(root, "config/modpacks/my-server.env");
    expect(result.file).toBe(file);
    const raw = fs.readFileSync(file, "utf8");
    expect(raw).toContain(servers.MANAGED_MARKER);

    const env = result.def.env;
    expect(env.TYPE).toBe("PAPER");
    expect(env.VERSION).toBe("1.21.4");
    expect(env.MEMORY).toBe("6G");
    expect(env.SERVER_NAME).toBe("my-server");
    expect(env.MAX_PLAYERS).toBe("30");
    expect(env.MOTD).toBe("hello world");
    expect(env.ENABLE_RCON).toBe("true");
    // skips the RCON port taken by the vanilla fixture
    expect(env.RCON_PORT).toBe("26566");
    expect(result.rconPort).toBe(26566);
  });

  it("registers the new server immediately, flagged as custom", async () => {
    const { servers, serverCreate } = await load();
    serverCreate.createServer({ name: "fresh", type: "vanilla" });
    const def = servers.getServerDef("fresh")!;
    expect(def).not.toBeNull();
    expect(def.source).toBe("custom");
    expect(def.connect).toBe("fresh.mc.test"); // shared env domain applies
    // and it joins the plain name list too
    expect(servers.listServerNames()).toEqual(["fresh", "vanilla"]);
  });

  it("inherits the shared env (RCON password, EULA) for RCON access", async () => {
    const { servers, serverCreate } = await load();
    serverCreate.createServer({ name: "fresh", type: "fabric" });
    expect(servers.rconPassword(servers.getServerDef("fresh")!)).toBe(
      "shared-secret",
    );
  });

  it("preserves literal quotes, shell text, dollar signs and backslashes in the registry", async () => {
    const { serverCreate } = await load();
    const motd = 'Let\'s play "Minecraft"; $(printf nope) $HOME # text \\';
    const result = serverCreate.createServer({
      name: "literal-values",
      type: "paper",
      motd,
      extraEnv: 'CUSTOM_TOKEN=$2a$10$abc\nEMPTY=\nJSON={"key":"value"}',
    });
    expect(result.def.env.MOTD).toBe(motd);
    expect(result.def.env.CUSTOM_TOKEN).toBe("$2a$10$abc");
    expect(result.def.env.EMPTY).toBe("");
    expect(result.def.env.JSON).toBe('{"key":"value"}');
    expect(fs.statSync(result.file).mode & 0o777).toBe(0o600);
  });

  it("rejects malformed JSON fields and injected env lines before writing a file", async () => {
    const { serverCreate } = await load();
    for (const fields of [
      { name: "x" },
      { name: "bad\nSERVER_NAME=other" },
      { type: "constructor" },
      { memory: null },
      { memory: "0G" },
      { version: [] },
      { version: "1.21\nRCON_PORT=1" },
      { motd: "hello\rSERVER_NAME=other" },
      { motd: "nul\0value" },
      { difficulty: true },
      { maxPlayers: "20" },
      { maxPlayers: 1.5 },
      { extraEnv: { TYPE: "PAPER" } },
      { extraEnv: "1INVALID=value" },
      { extraEnv: "A=one\rB=two" },
    ]) {
      expect(() =>
        serverCreate.createServer({
          name: "bad-input",
          type: "paper",
          ...fields,
        }),
      ).toThrow();
    }
    expect(fs.readdirSync(path.join(root, "config/modpacks"))).toEqual([
      "vanilla.env",
    ]);
  });

  it("rejects non-HTTP modpack URLs", async () => {
    const { serverCreate } = await load();
    expect(() =>
      serverCreate.createServer({
        name: "bad-pack",
        type: "curseforge",
        modpack: "javascript:alert(1)",
      }),
    ).toThrow(/HTTP/);
  });

  it("rejects duplicate, malformed names and bad values", async () => {
    const { serverCreate } = await load();
    expect(serverCreate.validateServerName("vanilla")).toMatch(/already/);
    expect(serverCreate.validateServerName("My-Server")).toMatch(/lowercase/);
    expect(serverCreate.validateServerName("-leading")).toMatch(/lowercase/);
    expect(serverCreate.validateServerName("trailing-")).toMatch(/lowercase/);
    expect(() =>
      serverCreate.createServer({ name: "xx", type: "paper", memory: "4TB" }),
    ).toThrow(/memory/i);
    expect(() =>
      serverCreate.createServer({ name: "xx", type: "paper", maxPlayers: 0 }),
    ).toThrow(/players/i);
    expect(() =>
      serverCreate.createServer({ name: "xx", type: "nope" }),
    ).toThrow(/unknown server type/i);
    expect(() =>
      serverCreate.createServer({
        name: "xx",
        type: "paper",
        extraEnv: "NOT A PAIR",
      }),
    ).toThrow(/invalid extra setting/i);
  });

  it("requires a modpack reference for pack types and stores slugs/URLs appropriately", async () => {
    const { servers, serverCreate } = await load();
    expect(() =>
      serverCreate.createServer({ name: "cf-1", type: "curseforge" }),
    ).toThrow(/reference is required/i);

    // bare slug -> CF_SLUG (registry builds the public page URL)
    serverCreate.createServer({
      name: "cf-slug",
      type: "curseforge",
      modpack: "better-mc-forge-bmc5",
    });
    const slugDef = servers.getServerDef("cf-slug")!;
    expect(slugDef.env.CF_SLUG).toBe("better-mc-forge-bmc5");
    expect(slugDef.env.AUTO_CURSEFORGE).toBeUndefined();
    expect(slugDef.env.CF_PAGE_URL).toBeUndefined();
    expect(slugDef.modUrl).toBe(
      "https://www.curseforge.com/minecraft/modpacks/better-mc-forge-bmc5",
    );
    // pack decides the version: no VERSION line unless one is given
    expect(slugDef.env.VERSION).toBeUndefined();

    serverCreate.createServer({
      name: "cf-url",
      type: "curseforge",
      modpack: "https://www.curseforge.com/minecraft/modpacks/rlcraft",
    });
    expect(servers.getServerDef("cf-url")!.env.CF_PAGE_URL).toBe(
      "https://www.curseforge.com/minecraft/modpacks/rlcraft",
    );

    serverCreate.createServer({
      name: "mr-1",
      type: "modrinth",
      modpack: "the-pixelmon-modpack",
    });
    expect(servers.getServerDef("mr-1")!.env.MODRINTH_MODPACK).toBe(
      "the-pixelmon-modpack",
    );
  });

  it("strips panel-managed keys from extra settings and merges the rest", async () => {
    const { serverCreate } = await load();
    const { env } = serverCreate.buildServerEnv(
      {
        name: "xx",
        type: "paper",
        extraEnv: "VIEW_DISTANCE=14\nSERVER_NAME=evil\nRCON_PORT=1\n# comment",
      },
      26600,
    );
    expect(env.VIEW_DISTANCE).toBe("14");
    expect(env.SERVER_NAME).toBe("xx");
    expect(env.RCON_PORT).toBe("26600");
  });
});

describe("deleteServer (docker runtime)", () => {
  it("removes panel-created servers but not the repo catalog", async () => {
    const { servers, serverCreate } = await load();
    expect(() => serverCreate.deleteServer("vanilla")).toThrow(/catalog/);

    serverCreate.createServer({ name: "temp", type: "vanilla" });
    const { file } = serverCreate.deleteServer("temp");
    expect(fs.existsSync(file)).toBe(false);
    expect(servers.getServerDef("temp")).toBeNull();
  });
});

describe("kubernetes runtime", () => {
  it("decodes the same literal env values for Kubernetes", async () => {
    process.env.MCPANEL_RUNTIME = "kubernetes";
    const { serverCreate } = await load();
    const { buildServerValues } = await import("@/lib/k8sValues");
    const motd = 'A "quote", $dollar, \\backslash and \'apostrophe';
    const result = serverCreate.createServer({
      name: "literal-k8s",
      type: "paper",
      motd,
    });
    expect(buildServerValues(result.def, 1).env.MOTD).toBe(motd);
  });

  it("writes new servers into the panel data dir (catalog is read-only)", async () => {
    process.env.MCPANEL_RUNTIME = "kubernetes";
    const { servers, serverCreate } = await load();

    const result = serverCreate.createServer({
      name: "k8s-made",
      type: "paper",
    });
    const file = path.join(data, "servers", "k8s-made.env");
    expect(result.file).toBe(file);
    expect(fs.existsSync(file)).toBe(true);
    // the repo catalog stays untouched
    expect(fs.existsSync(path.join(root, "config/modpacks/k8s-made.env"))).toBe(
      false,
    );

    const def = servers.getServerDef("k8s-made")!;
    expect(def.source).toBe("custom");
    expect(servers.listServerNames()).toEqual(["k8s-made", "vanilla"]);
  });

  it("lets a panel-data config override a catalog entry by name", async () => {
    process.env.MCPANEL_RUNTIME = "kubernetes";
    const { servers } = await load();
    fs.mkdirSync(path.join(data, "servers"), { recursive: true });
    fs.writeFileSync(
      path.join(data, "servers", "vanilla.env"),
      ["TYPE=PAPER", "MEMORY=99G"].join("\n"),
    );
    const def = servers.getServerDef("vanilla")!;
    expect(def.memory).toBe("99G");
    // an override in the writable dir becomes panel-managed
    expect(def.source).toBe("custom");
  });
});
