// End-to-end tests: real browser against the real built panel.
// Non-destructive by design: no server lifecycle actions are clicked.
import { expect, test } from "@playwright/test";

const USER = "e2e-admin";
const PASS = "e2e-password-4916";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/admin");
  await page.getByLabel("Username").fill(USER);
  // exact: the login form also has a "Show password" toggle button.
  await page.getByLabel("Password", { exact: true }).fill(PASS);
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
  await expect(
    page.getByRole("link", { name: /Manage .* in admin/ }),
  ).toHaveCount(0);
});

test("dashboard keeps one filter state across card and table views", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main article").first()).toBeVisible({
    timeout: 15_000,
  });

  await page
    .getByRole("button", { name: /^#quests/ })
    .first()
    .click();
  const matchingCards = await page.locator("main article").count();
  expect(matchingCards).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Table" }).click();
  await expect(page.getByLabel("Search servers")).toBeVisible();
  await expect(page.getByLabel("Search table")).toHaveCount(0);
  await expect(page.locator("table tbody tr")).toHaveCount(matchingCards);
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
  await page.getByLabel("Password", { exact: true }).fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid credentials")).toBeVisible();
  // Still on the login form
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("admin sign-in reveals the servers table", async ({ page }) => {
  await signIn(page);
  const search = page.getByLabel("Search admin servers");
  await expect(search).toBeVisible();
  await expect(
    page.getByLabel("Filter admin servers by platform"),
  ).toBeVisible();
  await expect(page.getByLabel("Filter admin servers by tag")).toBeVisible();
  await expect(page.getByLabel("Search table")).toHaveCount(0);
  await expect(
    page.getByRole("columnheader", { name: "Server" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Description" }),
  ).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Connect" })).toHaveCount(
    0,
  );
  const rows = page.locator("table tbody tr");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  const initialRows = await rows.count();
  expect(initialRows).toBeGreaterThanOrEqual(20);
  await search.fill("server-that-does-not-exist");
  await expect(
    page.getByText("No servers match the current filters."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(rows).toHaveCount(initialRows);
  // The compact table delegates the full data and advanced actions to a dialog.
  await rows.first().getByRole("button", { name: "Details" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Reported version")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Logs" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Console" })).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
});

test("admin dashboard links to the exact server row", async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  const manageLink = page
    .getByRole("link", { name: /Manage .* in admin/ })
    .first();
  await expect(manageLink).toBeVisible({ timeout: 15_000 });
  const href = await manageLink.getAttribute("href");
  expect(href).toMatch(/^\/admin\?server=.+#admin-server-.+$/);

  const serverName = new URL(href!, "http://localhost").searchParams.get(
    "server",
  );
  await manageLink.click();
  await expect(page).toHaveURL(new RegExp(`/admin\\?server=${serverName}`));
  await expect(page.getByLabel("Search admin servers")).toHaveValue(
    serverName!,
  );
  await expect(page.locator("table tbody tr")).toHaveCount(1);
  await expect(page.locator(`#admin-server-${serverName}`)).toBeVisible();
});

test("live logs modal opens for a server", async ({ page }) => {
  await signIn(page);
  const row = page.locator("table tbody tr").first();
  await row.getByRole("button", { name: "Details" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Logs" }).click();
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
  await expect(page.getByLabel("Filter backups by server")).toBeVisible();
  await expect(page.getByLabel("Search backups")).toBeVisible();
  await expect(page.getByLabel("Search table")).toHaveCount(0);
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
