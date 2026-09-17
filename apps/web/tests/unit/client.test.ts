// Pure helper functions used by the React islands.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  formatBytes,
  formatUptime,
  startPolling,
  timeAgo,
} from "@/lib/client";

describe("formatBytes", () => {
  it("returns a dash for zero/negative/invalid values", () => {
    expect(formatBytes(0)).toBe("—");
    expect(formatBytes(-5)).toBe("—");
    expect(formatBytes(Number.NaN)).toBe("—");
  });

  it("formats bytes without decimals", () => {
    expect(formatBytes(1)).toBe("1 B");
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats KB/MB/GB with one decimal under 100", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1024 ** 3)).toBe("1.0 GB");
  });

  it("drops decimals once the value is 100+ units", () => {
    expect(formatBytes(100 * 1024)).toBe("100 KB");
  });

  it("caps at the largest unit", () => {
    expect(formatBytes(1024 ** 5)).toBe("1024 TB");
  });
});

describe("formatUptime", () => {
  it("returns a dash for null/invalid", () => {
    expect(formatUptime(null)).toBe("—");
    expect(formatUptime(Number.NaN)).toBe("—");
  });

  it("renders days, hours, minutes and seconds", () => {
    expect(formatUptime(59)).toBe("59s");
    expect(formatUptime(60)).toBe("1m");
    expect(formatUptime(3661)).toBe("1h 1m");
    expect(formatUptime(2 * 86400 + 3600)).toBe("2d 1h");
  });
});

describe("timeAgo", () => {
  it("labels very recent timestamps", () => {
    expect(timeAgo(new Date().toISOString())).toBe("just now");
  });

  it("renders minutes, hours and days", () => {
    const now = Date.now();
    expect(timeAgo(new Date(now - 5 * 60_000).toISOString())).toBe("5 min ago");
    expect(timeAgo(new Date(now - 3 * 3_600_000).toISOString())).toBe(
      "3 h ago",
    );
    expect(timeAgo(new Date(now - 2 * 86_400_000).toISOString())).toBe(
      "2 days ago",
    );
  });
});

const fetchMock = vi.hoisted(() => vi.fn());

describe("api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks mutating requests with the CSRF header and same-origin credentials", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: 1 })));
    await api("/api/servers/x/action", { method: "POST", json: {} });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.credentials).toBe("same-origin");
    expect(init.headers).toBeInstanceOf(Headers);
    expect(init.headers.get("x-mcpanel")).toBe("1");
    expect(init.method).toBe("POST");
  });

  it("serializes the json option into a request body", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    await api("/api/servers", { method: "POST", json: { name: "vanilla" } });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.get("content-type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "vanilla" }));
  });

  it("keeps custom headers when json is not used", async () => {
    fetchMock.mockResolvedValue(new Response("{}"));
    await api("/api/x", { headers: { authorization: "Bearer t" } });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.get("authorization")).toBe("Bearer t");
    expect(init.headers.get("content-type")).toBeNull();
    expect(init.body).toBeUndefined();
  });

  it("throws the server's error message on failure", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "server busy" }), { status: 409 }),
    );
    await expect(api("/api/x")).rejects.toThrow("server busy");
  });

  it("falls back to the HTTP status when an error body is not JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>502</html>", { status: 502 }),
    );
    await expect(api("/api/x")).rejects.toThrow("Error 502");
  });

  it("resolves with an empty object for a non-JSON success body", async () => {
    fetchMock.mockResolvedValue(new Response("Accepted", { status: 202 }));
    await expect(api("/api/x")).resolves.toEqual({});
  });
});

describe("startPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("document", {
      visibilityState: "visible",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fetches immediately and then on every interval tick", () => {
    const fn = vi.fn();
    const stop = startPolling(fn, 5_000);
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5_000);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(5_000);
    expect(fn).toHaveBeenCalledTimes(3);
    stop();
  });

  it("skips ticks while the tab is hidden", () => {
    const fn = vi.fn();
    const document = globalThis.document as { visibilityState: string };
    const stop = startPolling(fn, 5_000);

    document.visibilityState = "hidden";
    vi.advanceTimersByTime(15_000);
    expect(fn).toHaveBeenCalledTimes(1); // only the initial call

    document.visibilityState = "visible";
    vi.advanceTimersByTime(5_000);
    expect(fn).toHaveBeenCalledTimes(2);
    stop();
  });

  it("stop() cancels the interval and the visibility listener", () => {
    const fn = vi.fn();
    const doc = globalThis.document as unknown as {
      visibilityState: string;
      addEventListener: ReturnType<typeof vi.fn>;
      removeEventListener: ReturnType<typeof vi.fn>;
    };
    const stop = startPolling(fn, 5_000);

    stop();
    expect(doc.removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      doc.addEventListener.mock.calls[0][1],
    );
    vi.advanceTimersByTime(20_000);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
