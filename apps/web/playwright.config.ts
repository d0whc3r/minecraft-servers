import { defineConfig } from "@playwright/test";

// E2E tests run the REAL built panel on port 4599 with throwaway credentials
// and an isolated data dir, so the production instance and its data dir are
// never touched. Requires a prior `pnpm build` (the test:e2e script does it).
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:4599",
    channel: "chrome",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node ./dist/server/entry.mjs",
    url: "http://127.0.0.1:4599/api/auth/me",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      HOST: "127.0.0.1",
      PORT: "4599",
      MCPANEL_USER: "e2e-admin",
      MCPANEL_PASSWORD: "e2e-password-4916",
      MCPANEL_DATA_DIR: "./test-e2e-data",
    },
  },
});
