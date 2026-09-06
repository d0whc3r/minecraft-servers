// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";

// SSR everywhere: the panel is a live dashboard backed by docker/RCON APIs.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  server: {
    // Never expose the dev toolbar/provenance in a management panel
    security: { checkOrigin: true },
  },
});
