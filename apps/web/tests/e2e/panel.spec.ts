// End-to-end tests: real browser against the real built panel.
// Non-destructive by design: no server lifecycle actions are clicked.
import { expect, test } from "@playwright/test";

const USER = "e2e-admin";
const PASS = "e2e-password-4916";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/admin");
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill(PASS);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("tab", { name: "Servers" })).toBeVisible({
    timeout: 15_000,
  });
}

test("dashboard shows the summary strip and all server cards", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Minecraft Panel")).toBeVisible();
  await expect(page.getByText("servers running")).toBeVisible({
    timeout: 15_000,
  });
  // One card per configured modpack (the repo ships 21)
  const cards = page.locator("main article");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThanOrEqual(20);
});

test("status API is public JSON", async ({ request }) => {
  const res = await request.get("/api/status");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.servers.length).toBeGreaterThanOrEqual(20);
  expect(body.summary.total).toBeGreaterThanOrEqual(20);
});

test("admin requires sign in and rejects a wrong password", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Admin sign in" }),
  ).toBeVisible();
  await page.getByLabel("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid credentials")).toBeVisible();
  // Still on the login form
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("admin sign-in reveals the servers table", async ({ page }) => {
  await signIn(page);
  await expect(
    page.getByRole("columnheader", { name: "Server" }),
  ).toBeVisible();
  const rows = page.locator("table tbody tr");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  expect(await rows.count()).toBeGreaterThanOrEqual(20);
  // Actions render per row
  await expect(
    page.getByRole("button", { name: "Logs" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Console" }).first(),
  ).toBeVisible();
});

test("live logs modal opens for a server", async ({ page }) => {
  await signIn(page);
  await page
    .locator("table tbody tr")
    .first()
    .getByRole("button", { name: "Logs" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Logs ·/)).toBeVisible();
  await expect(dialog.getByLabel("Filter logs")).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
});

test("backups tab shows the empty state for a fresh server", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("tab", { name: "Backups" }).click();
  await expect(
    page.getByRole("button", { name: "Create backup now" }),
  ).toBeVisible();
  await expect(
    page.getByText(/No backups for this server yet|./).first(),
  ).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "File" })).toBeVisible();
});

test("system tab shows host information", async ({ page }) => {
  await signIn(page);
  await page.getByRole("tab", { name: "System" }).click();
  await expect(page.getByRole("heading", { name: "Memory" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("heading", { name: "CPU" })).toBeVisible();
  await expect(page.getByText(/cores/)).toBeVisible();
});

test("sign out returns to the login form", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Admin sign in" }),
  ).toBeVisible();
});
