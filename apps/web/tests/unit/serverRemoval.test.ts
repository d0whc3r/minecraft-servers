import type { APIRoute } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  stopped: vi.fn<() => Promise<boolean>>(),
  remove: vi.fn(),
  action: vi.fn(),
  getServerDef: vi.fn(),
}));
vi.mock("@/lib/backend.js", () => ({
  backend: { isServerStopped: mocks.stopped },
}));
vi.mock("@/lib/serverCreate.js", () => ({ deleteServer: mocks.remove }));
vi.mock("@/lib/servers.js", () => ({
  PROJECT_ROOT: "/fixture",
  getServerDef: mocks.getServerDef,
}));
vi.mock("@/lib/runtime.js", () => ({ RUNTIME: "kubernetes" }));
vi.mock("@/lib/k8s.js", () => ({ runAction: mocks.action }));
vi.mock("@/lib/api.js", () => ({
  guardAuth: () => null,
  guardCsrf: () => null,
  getServerParam: () => "test-server",
  json: (body: unknown) => Response.json(body),
  apiError: (error: string, status: number) =>
    Response.json({ error }, { status }),
}));

import { DELETE } from "@/pages/api/servers/[server]";
import { isActionRunning, runAction } from "@/lib/actions";

const context = {} as Parameters<APIRoute>[0];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.stopped.mockResolvedValue(true);
  mocks.remove.mockReturnValue({ file: "/fixture/test-server.env" });
  mocks.getServerDef.mockReturnValue({ name: "test-server" });
});

describe("server removal", () => {
  it("checks current backend state for each request before removing config", async () => {
    expect((await DELETE(context)).status).toBe(200);
    mocks.stopped.mockResolvedValue(false);
    expect((await DELETE(context)).status).toBe(409);
    expect(mocks.stopped).toHaveBeenCalledTimes(2);
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });

  it("keeps config when the backend cannot establish workload state", async () => {
    mocks.stopped.mockRejectedValueOnce(new Error("cluster unavailable"));
    expect((await DELETE(context)).status).toBe(503);
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(isActionRunning("test-server")).toBe(false);
    expect((await DELETE(context)).status).toBe(200);
  });

  it("rejects deletion while an actual lifecycle action is pending", async () => {
    const pending = deferred<never>();
    mocks.action.mockReturnValueOnce(pending.promise);
    const start = runAction("start", "test-server");
    expect(isActionRunning("test-server")).toBe(true);
    expect((await DELETE(context)).status).toBe(409);
    expect(mocks.stopped).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    const rejected = expect(start).rejects.toThrow("start failed");
    pending.reject(new Error("start failed"));
    await rejected;
    expect(isActionRunning("test-server")).toBe(false);
  });

  it("rejects start and a second delete while the removal check is pending", async () => {
    const pending = deferred<boolean>();
    mocks.stopped.mockReturnValueOnce(pending.promise);
    const removal = DELETE(context);
    await expect(runAction("start", "test-server")).rejects.toThrow(
      "Another action",
    );
    expect((await DELETE(context)).status).toBe(409);
    expect(mocks.action).not.toHaveBeenCalled();
    pending.resolve(true);
    expect((await removal).status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    expect(isActionRunning("test-server")).toBe(false);
  });

  it("revalidates the registry before starting after a concurrent removal", async () => {
    mocks.getServerDef.mockReturnValueOnce(null);
    await expect(runAction("start", "test-server")).rejects.toThrow(
      "Unknown server",
    );
    expect(mocks.action).not.toHaveBeenCalled();
    expect(isActionRunning("test-server")).toBe(false);
  });
});
