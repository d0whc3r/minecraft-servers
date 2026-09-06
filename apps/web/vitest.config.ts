import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Modules read MCPANEL_* env and cache state at import time; isolate graphs.
    restoreMocks: true,
  },
});
