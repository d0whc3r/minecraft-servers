// Unit tests for the server registry, using an isolated MCPANEL_ROOT fixture
// that mimics the repo layout (config/modpacks, docs/modpacks, .env).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let root: string;

function write(rel: string, content: string) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

beforeEach(() => {
  vi.resetModules();
  root = fs.mkdtempSync(path.join(os.tmpdir(), "mcpanel-root-"));
  process.env.MCPANEL_ROOT = root;

  write(
    ".env",
    [
      "EULA=TRUE",
      "RCON_PASSWORD=shared-secret",
      "CF_API_KEY=$2a$10$topsecret",
      "MC_ROUTER_DOMAIN=mc.test",
      "MC_ROUTER_PORT=25599",
    ].join("\n"),
  );
  write(
    "config/modpacks/vanilla.env",
    [
      "TYPE=PAPER",
      "VERSION=1.21.1",
      "MEMORY=2G",
      "RCON_PORT=26567",
      "MAX_PLAYERS=20",
      "ENABLE_RCON=true",
    ].join("\n"),
  );
  write(
    "config/modpacks/rlcraft.env",
    [
      "TYPE=AUTO_CURSEFORGE",
      "VERSION=1.12.2",
      "MEMORY=6G",
      "MODRINTH_MODPACK=",
      "CF_API_KEY=$2a$10$per-server-key",
    ].join("\n"),
  );
  write(
    "config/modpacks/pixelmon.env",
    [
      "TYPE=AUTO_CURSEFORGE",
      "MODRINTH_MODPACK=pixelmon",
      "RCON_PORT=26582",
    ].join("\n"),
  );
  write(
    "docs/modpacks/vanilla.md",
    [
      "# Vanilla (Paper)",
      "",
      "## Overview",
      "",
      "Optimized vanilla experience for testing.",
    ].join("\n"),
  );
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

async function loadServers() {
  return import("../../src/lib/servers");
}

describe("server registry", () => {
  it("lists every config file as a server", async () => {
    const servers = await loadServers();
    expect(servers.listServerNames()).toEqual([
      "pixelmon",
      "rlcraft",
      "vanilla",
    ]);
  });

  it("merges shared env with per-server overrides", async () => {
    const servers = await loadServers();
    const def = servers.getServerDef("vanilla")!;
    expect(def.env.RCON_PASSWORD).toBe("shared-secret");
    expect(def.env.CF_API_KEY).toBe("$2a$10$topsecret");
    const rl = servers.getServerDef("rlcraft")!;
    expect(rl.env.CF_API_KEY).toBe("$2a$10$per-server-key");
  });

  it("exposes core metadata", async () => {
    const servers = await loadServers();
    const def = servers.getServerDef("vanilla")!;
    expect(def.title).toBe("Vanilla (Paper)"); // from docs/modpacks heading
    expect(def.platform).toBe("Paper");
    expect(def.mcVersion).toBe("1.21.1");
    expect(def.memory).toBe("2G");
    expect(def.connect).toBe("vanilla.mc.test"); // SERVER_NAME + MC_ROUTER_DOMAIN
    expect(def.rconPort).toBe(26567);
    expect(def.maxPlayers).toBe(20);
    expect(def.description).toContain("Optimized vanilla experience");
  });

  it("detects platforms (CurseForge vs Modrinth vs Paper)", async () => {
    const servers = await loadServers();
    expect(servers.getServerDef("rlcraft")!.platform).toBe("CurseForge");
    expect(servers.getServerDef("pixelmon")!.platform).toBe("Modrinth");
  });

  it("exposes the official modpack page URL", async () => {
    write(
      "config/modpacks/cf-page.env",
      [
        "TYPE=AUTO_CURSEFORGE",
        "CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/rlcraft",
      ].join("\n"),
    );
    write(
      "config/modpacks/cf-slug.env",
      ["TYPE=AUTO_CURSEFORGE", "AUTO_CURSEFORGE=rlcraft"].join("\n"),
    );
    write(
      "config/modpacks/modrinth-url.env",
      [
        "TYPE=MODRINTH",
        "MODRINTH_MODPACK=https://modrinth.com/modpack/sky",
      ].join("\n"),
    );
    const servers = await loadServers();
    // Plain server types and packs without a declared source have no page
    expect(servers.getServerDef("vanilla")!.modUrl).toBeNull();
    expect(servers.getServerDef("rlcraft")!.modUrl).toBeNull();
    // Modrinth slug builds the project URL
    expect(servers.getServerDef("pixelmon")!.modUrl).toBe(
      "https://modrinth.com/modpack/pixelmon",
    );
    // CurseForge page URL is used as-is, bare slugs build it
    expect(servers.getServerDef("cf-page")!.modUrl).toBe(
      "https://www.curseforge.com/minecraft/modpacks/rlcraft",
    );
    expect(servers.getServerDef("cf-slug")!.modUrl).toBe(
      "https://www.curseforge.com/minecraft/modpacks/rlcraft",
    );
    // Full URLs pass through untouched
    expect(servers.getServerDef("modrinth-url")!.modUrl).toBe(
      "https://modrinth.com/modpack/sky",
    );
  });

  it("exposes the router entry point from the shared env", async () => {
    const servers = await loadServers();
    expect(servers.getRouterConfig()).toEqual({
      host: "127.0.0.1",
      domain: "mc.test",
      port: 25599,
    });
    expect(servers.getServerDef("rlcraft")!.connect).toBe("rlcraft.mc.test");
  });

  it("returns null for unknown servers and falls back to a pretty title", async () => {
    const servers = await loadServers();
    expect(servers.getServerDef("nope")).toBeNull();
    expect(servers.getServerDef("pixelmon")!.title).toBe("Pixelmon"); // prettified name
  });

  it("provides the RCON password (shared or overridden)", async () => {
    const servers = await loadServers();
    expect(servers.rconPassword(servers.getServerDef("vanilla")!)).toBe(
      "shared-secret",
    );
  });
});

describe("maskSecrets", () => {
  it("hides sensitive values and leaves the rest untouched", async () => {
    const servers = await loadServers();
    const masked = servers.maskSecrets({
      RCON_PASSWORD: "hunter2",
      CF_API_KEY: "topsecret",
      MEMORY: "4G",
      TYPE: "PAPER",
    });
    expect(masked.RCON_PASSWORD).toBe("••••••••");
    expect(masked.CF_API_KEY).toBe("••••••••");
    expect(masked.MEMORY).toBe("4G");
    expect(masked.TYPE).toBe("PAPER");
  });
});

describe("rconHost", () => {
  it("defaults to loopback (native run)", async () => {
    delete process.env.MCPANEL_RCON_HOST;
    vi.resetModules();
    const servers = await loadServers();
    expect(servers.rconHost("vanilla")).toBe("127.0.0.1");
  });

  it("uses container DNS in container mode", async () => {
    process.env.MCPANEL_RCON_HOST = "container";
    vi.resetModules();
    const servers = await loadServers();
    expect(servers.rconHost("vanilla")).toBe("mc-vanilla");
    expect(servers.rconHost("rlcraft")).toBe("mc-rlcraft");
    delete process.env.MCPANEL_RCON_HOST;
  });
});
