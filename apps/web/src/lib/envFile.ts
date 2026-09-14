// Reading of the repo's .env config files (shared .env + config/modpacks/*.env
// + panel-created ones). Pure file parsing; no registry state.
import fs from "node:fs";

export function listEnvFiles(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".env"))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Parses KEY=VALUE lines with itzg-style quoting: double-quoted values decode
 * escapes (\\, \", \n, \r, \t) and $$ → $; single-quoted values are literal
 * except \'. Comments and blank lines are dropped.
 */
export function parseEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  let raw = "";
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed
      .slice(0, eq)
      .trim()
      .replace(/^export\s+/, "");
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      const singleQuoted = value.startsWith("'");
      value = value.slice(1, -1);
      if (singleQuoted) value = value.replace(/\\'/g, "'");
      else
        value = value.replace(/\\([\\"nrt])|\$\$/g, (match, escape) => {
          if (match === "$$") return "$";
          switch (escape) {
            case "n":
              return "\n";
            case "r":
              return "\r";
            case "t":
              return "\t";
            default:
              return escape;
          }
        });
    }
    out[key] = value;
  }
  return out;
}
