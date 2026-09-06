// Every API request is mocked: creation and starts cannot touch real servers.
import { expect, test, type Page } from "@playwright/test";

const types = [
  {
    id: "paper",
    label: "Paper",
    defaultVersion: "LATEST",
    modpackRequired: false,
  },
  {
    id: "modrinth",
    label: "Modrinth",
    defaultVersion: "",
    modpackRequired: true,
  },
];

async function mockPanel(page: Page) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") {
      await route.fulfill({
        json: { authed: true, user: "test", publicView: true },
      });
    } else if (path === "/api/status") {
      await route.fulfill({
        json: {
          servers: [],
          now: Date.now(),
          cached: false,
          router: { domain: "test.invalid", port: 25565 },
          summary: {
            total: 0,
            running: 0,
            stopped: 0,
            unhealthy: 0,
            playersOnline: 0,
            playersMax: 0,
          },
        },
      });
    } else {
      await route.abort("blockedbyclient");
      throw new Error(
        `Unexpected API request: ${route.request().method()} ${path}`,
      );
    }
  });
}

async function openCreate(page: Page) {
  await page.goto("/admin");
  await page.getByRole("button", { name: "+ New server" }).click();
  return page.getByRole("dialog", { name: "New server" });
}

test("catalog failure blocks creation and retry preserves input", async ({
  page,
}) => {
  await mockPanel(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let loads = 0;
  let creates = 0;
  await page.route("**/api/servers", async (route) => {
    if (route.request().method() === "POST") {
      creates++;
      await route.fulfill({ json: { name: "test-server" } });
    } else if (++loads === 1) {
      await pending;
      await route.fulfill({
        status: 503,
        json: { error: "Catalog unavailable" },
      });
    } else {
      await route.fulfill({ json: { types: [types[1]] } });
    }
  });
  const dialog = await openCreate(page);
  await expect(dialog.getByRole("status")).toHaveText("Loading server types…");
  const name = dialog.getByLabel("Server name", { exact: false });
  await name.fill("test-server");
  await expect(
    dialog.getByRole("button", { name: "Create server" }),
  ).toBeDisabled();
  await name.press("Enter");
  expect(creates).toBe(0);
  release();
  await expect(dialog.getByRole("alert")).toContainText("Catalog unavailable");
  await expect(
    dialog.getByRole("button", { name: "Create server" }),
  ).toBeDisabled();
  await expect(name).toBeFocused();
  await dialog.getByRole("button", { name: "Retry" }).click();
  await expect(dialog.getByLabel("Server type")).toHaveValue("modrinth");
  await expect(
    dialog.getByLabel("Modpack (Modrinth: URL or slug)"),
  ).toBeVisible();
  await expect(name).toHaveValue("test-server");
  await expect(
    dialog.getByRole("button", { name: "Create server" }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  expect(creates).toBe(0);
});

test("keyboard focus stays in modal and returns to its trigger", async ({
  page,
}) => {
  await mockPanel(page);
  await page.route("**/api/servers", (route) =>
    route.fulfill({ json: { types } }),
  );
  const dialog = await openCreate(page);
  const close = dialog.getByRole("button", { name: "Close", exact: true });
  const cancel = dialog.getByRole("button", { name: "Cancel" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await dialog.getByLabel("MOTD (optional)").fill("Keyboard test");
  await expect(dialog.getByLabel("MOTD (optional)")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "+ New server" }),
  ).toBeFocused();
});

test("pending creation blocks closing and edits, then recovers from failure", async ({
  page,
}) => {
  await mockPanel(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let creates = 0;
  await page.route("**/api/servers", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { types } });
      return;
    }
    creates++;
    await pending;
    await route.fulfill({
      status: 409,
      json: { error: "Server already exists" },
    });
  });
  const dialog = await openCreate(page);
  await dialog.getByLabel("Server name", { exact: false }).fill("test-server");
  await dialog.getByRole("button", { name: "Create server" }).click();
  await expect(
    dialog.getByRole("button", { name: "Creating…" }),
  ).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Close", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByLabel("Start the server right after creating it"),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.mouse.click(2, 2);
  await page.keyboard.press("Tab");
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();
  expect(creates).toBe(1);
  release();
  await expect(dialog.getByRole("alert")).toHaveText("Server already exists");
  await expect(
    dialog.getByRole("button", { name: "Create server" }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

for (const startNow of [false, true]) {
  test(`creation respects start immediately = ${startNow}`, async ({
    page,
  }) => {
    await mockPanel(page);
    let creates = 0;
    let starts = 0;
    await page.route("**/api/servers", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: { types } });
      } else {
        creates++;
        expect(route.request().postDataJSON()).toMatchObject({
          name: "test-server",
          type: "paper",
        });
        await route.fulfill({ json: { name: "test-server" } });
      }
    });
    await page.route("**/api/action/test-server/start", async (route) => {
      starts++;
      await route.fulfill({ json: { ok: true, output: "Started (mock)" } });
    });
    const dialog = await openCreate(page);
    await dialog
      .getByLabel("Server name", { exact: false })
      .fill("test-server");
    await dialog
      .getByLabel("Start the server right after creating it")
      .setChecked(startNow);
    await dialog.getByRole("button", { name: "Create server" }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByText("Created test-server", { exact: true }),
    ).toBeVisible();
    expect(creates).toBe(1);
    await expect.poll(() => starts).toBe(startNow ? 1 : 0);
  });
}
