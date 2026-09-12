// @ts-check
import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";

// A Vite dev server never populates process.env from .env files (only the
// built server sees real environment variables), so without this the panel
// would ignore apps/web/.env on `astro dev` — the MCPANEL_USER/MCPANEL_PASSWORD
// credentials would only work in Docker. Load the .env here so dev and native
// runs configure exactly like the container one: variables already present in
// the environment always win, and empty values stay unset so the
// "leave MCPANEL_PASSWORD empty to auto-generate" behavior is preserved.
const dotenvFiles = [".env", ".env.local"];
const dotenv = {};
for (const name of dotenvFiles) {
  try {
    Object.assign(
      dotenv,
      parseEnv(fs.readFileSync(path.resolve(process.cwd(), name), "utf8")),
    );
  } catch {
    // The file is optional.
  }
}
for (const [key, value] of Object.entries(dotenv)) {
  if (value !== "" && process.env[key] === undefined) process.env[key] = value;
}

// SSR everywhere: the panel is a live dashboard backed by docker/RCON APIs.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  server: {
    // Never expose the dev toolbar/provenance in a management panel
    security: { checkOrigin: true },
  },
});
