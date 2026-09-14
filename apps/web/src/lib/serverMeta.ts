// Server display metadata derived from a server's env record and its doc page
// (docs/modpacks/<name>.md): title, description, tags, platform and the
// official modpack URL.
import fs from "node:fs";
import path from "node:path";

function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        // a trailing markdown hard-break "\" would otherwise become a tag
        .replace(/\\+/g, "")
        .split(/[,\s]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function prettifyName(name: string): string {
  return name
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function readDocMeta(
  projectRoot: string,
  name: string,
): {
  title?: string;
  description?: string;
  tags?: string[];
} {
  const docPath = path.join(projectRoot, "docs/modpacks", `${name}.md`);
  if (!fs.existsSync(docPath)) return {};
  const raw = fs.readFileSync(docPath, "utf8");
  const lines = raw.split(/\r?\n/);
  let title: string | undefined;
  let description: string | undefined;
  let tags: string[] | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!title && line.startsWith("# ") && line.length > 2) {
      title = line.slice(2).trim();
      continue;
    }
    if (!tags && /^\*{0,2}tags\*{0,2}:/i.test(line)) {
      tags = parseTags(line.replace(/^\*{0,2}tags\*{0,2}:\s*/i, ""));
      continue;
    }
    if (!description && /^## Overview/i.test(line)) {
      for (let j = i + 1; j < lines.length; j++) {
        const d = lines[j].trim();
        if (!d || d.startsWith("#")) continue;
        description = d.replace(/\s+/g, " ").slice(0, 220);
        break;
      }
    }
    if (title && description && tags) break;
  }
  return { title, description, tags };
}

export function detectPlatform(
  env: Record<string, string>,
  type: string,
): string {
  if (env.MODRINTH_MODPACK) return "Modrinth";
  if (env.AUTO_CURSEFORGE || /CURSEFORGE/i.test(type)) return "CurseForge";
  if (/PAPER/i.test(type)) return "Paper";
  if (/FABRIC/i.test(type)) return "Fabric";
  if (/VANILLA/i.test(type)) return "Vanilla";
  if (/SPIGOT/i.test(type)) return "Spigot";
  if (/NEOFORGE/i.test(type)) return "NeoForge";
  if (/FORGE/i.test(type)) return "Forge";
  return type ? type.charAt(0) + type.slice(1).toLowerCase() : "Unknown";
}

/**
 * Official modpack page, from whatever source field the pack declares:
 * MODRINTH_MODPACK (slug or URL), CF_PAGE_URL, or CF_SLUG.
 * Server types without a modpack (Paper, Vanilla,…) return null.
 */
export function modpackUrl(env: Record<string, string>): string | null {
  const asUrl = (value: string, base: string) =>
    /^https?:\/\//.test(value) ? value : base + value;
  if (env.MODRINTH_MODPACK)
    return asUrl(env.MODRINTH_MODPACK, "https://modrinth.com/modpack/");
  if (env.CF_PAGE_URL) return env.CF_PAGE_URL;
  if (env.CF_SLUG)
    return asUrl(env.CF_SLUG, "https://www.curseforge.com/minecraft/modpacks/");
  if (env.AUTO_CURSEFORGE)
    return asUrl(
      env.AUTO_CURSEFORGE,
      "https://www.curseforge.com/minecraft/modpacks/",
    );
  return null;
}

export { parseTags };
