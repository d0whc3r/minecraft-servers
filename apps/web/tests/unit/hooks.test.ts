// @vitest-environment jsdom
// The two dashboard hooks: useStatusPolling must keep polling across renders
// while always calling the latest onData, and useLogStream must merge the
// one-shot tail history with the live SSE stream without ever dropping or
// reordering lines that arrived while history was still in flight.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  startPolling: vi.fn(),
}));

vi.mock("@/lib/client", () => ({
  api: mocks.api,
  startPolling: mocks.startPolling,
}));

import { act, renderHook, waitFor } from "@testing-library/react";
import type { StatusResponse } from "@/types";
import { useStatusPolling } from "@/hooks/useStatusPolling";
import { useLogStream } from "@/hooks/useLogStream";

const statusPayload = {
  now: 1,
  cached: false,
  router: { domain: "mc.test", port: 25565 },
  servers: [],
  summary: {
    total: 0,
    running: 0,
    stopped: 0,
    unhealthy: 0,
    playersOnline: 0,
    playersMax: 0,
  },
} as StatusResponse;

describe("useStatusPolling", () => {
  let tick: () => Promise<void>;
  const stop = vi.fn();

  beforeEach(() => {
    stop.mockClear();
    mocks.api.mockResolvedValue(statusPayload);
    // Same contract as the real startPolling: fires once immediately, hands
    // back the stop function, and exposes the tick for manual triggering.
    mocks.startPolling.mockImplementation((fn: typeof tick) => {
      tick = fn;
      void fn();
      return stop;
    });
  });

  it("exposes the fetched status, the interval and the onData callback", async () => {
    const onData = vi.fn();
    const { result } = renderHook(() => useStatusPolling(2500, onData));

    await waitFor(() => expect(result.current.status).toBe(statusPayload));
    expect(result.current.error).toBeNull();
    expect(onData).toHaveBeenCalledWith(statusPayload);
    expect(mocks.startPolling).toHaveBeenCalledWith(expect.any(Function), 2500);
  });

  it("keeps the last good status when a refresh fails", async () => {
    const { result } = renderHook(() => useStatusPolling());
    await waitFor(() => expect(result.current.status).toBe(statusPayload));

    mocks.api.mockRejectedValue(new Error("network gone"));
    await act(() => tick());

    expect(result.current.error).toBe("network gone");
    expect(result.current.status).toBe(statusPayload);
  });

  it("recovers the error flag once a refresh succeeds again", async () => {
    mocks.api.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useStatusPolling());
    await waitFor(() => expect(result.current.error).toBe("boom"));
    await act(() => tick());
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe(statusPayload);
  });

  it("re-arms the poller on interval changes without leaking the old one", () => {
    const { rerender, unmount } = renderHook(({ ms }) => useStatusPolling(ms), {
      initialProps: { ms: 5000 },
    });
    rerender({ ms: 1000 });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(mocks.startPolling).toHaveBeenCalledTimes(2);
    expect(mocks.startPolling).toHaveBeenLastCalledWith(
      expect.any(Function),
      1000,
    );
    unmount();
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it("routes data to the latest onData without restarting the poller", async () => {
    const first = vi.fn();
    const { rerender } = renderHook(({ cb }) => useStatusPolling(5000, cb), {
      initialProps: { cb: first },
    });
    const latest = vi.fn();
    rerender({ cb: latest });
    rerender({ cb: latest });

    expect(mocks.startPolling).toHaveBeenCalledTimes(1);
    await act(() => tick());
    // Data always lands on the newest callback: the rerenders replaced the
    // ref before the first response arrived, so `first` never sees data.
    expect(latest).toHaveBeenCalledWith(statusPayload);
    expect(first).not.toHaveBeenCalled();
  });
});

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  closed = false;
  close = vi.fn(() => {
    this.closed = true;
  });
  private handlers = new Map<
    string,
    Array<(ev: MessageEvent | Event) => void>
  >();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: (ev: MessageEvent | Event) => void) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }

  emit(type: string, event: MessageEvent | Event) {
    for (const handler of this.handlers.get(type) ?? []) handler(event);
  }
}

const logEvent = (line: string) =>
  new MessageEvent("log", { data: JSON.stringify(line) });

describe("useLogStream", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const lastStream = () => FakeEventSource.instances.at(-1)!;

  it("opens the SSE stream and loads the tail as history", async () => {
    fetchMock.mockResolvedValue(
      new Response("history-1\nhistory-2", { status: 200 }),
    );
    const { result } = renderHook(() => useLogStream("vanilla"));

    expect(lastStream().url).toBe("/api/logs/vanilla/stream");
    expect(fetchMock).toHaveBeenCalledWith("/api/logs/vanilla/tail?tail=300");
    await waitFor(() => expect(result.current.status).toBe("history loaded"));
    expect(result.current.lines).toEqual(["history-1", "history-2"]);

    act(() => lastStream().emit("log", logEvent("live-1")));
    expect(result.current.lines).toEqual(["history-1", "history-2", "live-1"]);
    expect(result.current.status).toBe("live");
  });

  it("prepends late history without clobbering live lines that arrived first", async () => {
    let resolveTail!: (response: Response) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveTail = resolve;
        }),
    );
    const { result } = renderHook(() => useLogStream("vanilla"));
    const es = lastStream();

    // Live traffic starts while the tail request is still in flight.
    act(() => es.emit("log", logEvent("live-first")));
    expect(result.current.lines).toEqual(["live-first"]);

    await act(async () => resolveTail(new Response("h1\nh2")));
    expect(result.current.lines).toEqual(["h1", "h2", "live-first"]);
  });

  it("caps the buffer at 800 lines, dropping the oldest", async () => {
    fetchMock.mockResolvedValue(new Response("old", { status: 200 }));
    const { result } = renderHook(() => useLogStream("vanilla"));
    await waitFor(() => expect(result.current.status).toBe("history loaded"));

    const es = lastStream();
    for (let i = 0; i < 805; i++) {
      act(() => es.emit("log", logEvent(`line-${i}`)));
    }
    expect(result.current.lines).toHaveLength(800);
    expect(result.current.lines[0]).toBe("line-5");
    expect(result.current.lines.at(-1)).toBe("line-804");
  });

  it("ignores stream events that arrive after unmount", async () => {
    fetchMock.mockResolvedValue(new Response("history", { status: 200 }));
    const { result, unmount } = renderHook(() => useLogStream("vanilla"));
    await waitFor(() => expect(result.current.status).toBe("history loaded"));

    unmount();
    act(() => lastStream().emit("log", logEvent("too-late")));
    // The buffer froze at unmount; no state updates on a dead component.
    expect(result.current.lines).toEqual(["history"]);
    expect(result.current.status).toBe("history loaded");
  });

  it("marks the stream as closed on the terminal end event", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));
    const { result } = renderHook(() => useLogStream("vanilla"));
    const es = lastStream();
    act(() => es.emit("end", new MessageEvent("end")));
    expect(es.close).toHaveBeenCalled();
    expect(result.current.status).toBe("stream closed");
  });

  it("closes on server error events but lets network errors reconnect", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));
    const server = renderHook(() => useLogStream("vanilla"));
    const serverEs = lastStream();
    act(() => serverEs.emit("error", new MessageEvent("error")));
    expect(serverEs.close).toHaveBeenCalled();
    expect(server.result.current.status).toBe("stream error");

    const network = renderHook(() => useLogStream("vanilla"));
    const networkEs = lastStream();
    act(() => networkEs.emit("error", new Event("error")));
    expect(networkEs.close).not.toHaveBeenCalled();
    expect(network.result.current.status).toBe("stream error");
  });

  it("survives a failed tail fetch and stays live-only", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    const { result } = renderHook(() => useLogStream("vanilla"));
    await waitFor(() =>
      expect(result.current.status).toBe("history unavailable (live only)"),
    );
    expect(result.current.lines).toEqual([]);
  });

  it("closes the stream on unmount and when the server changes", () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));
    const { rerender, unmount } = renderHook(
      ({ server }) => useLogStream(server),
      { initialProps: { server: "alpha" } },
    );
    const alphaEs = lastStream();

    rerender({ server: "beta" });
    const betaEs = lastStream();
    expect(betaEs).not.toBe(alphaEs);
    expect(betaEs.url).toBe("/api/logs/beta/stream");
    expect(alphaEs.close).toHaveBeenCalled();

    unmount();
    expect(betaEs.close).toHaveBeenCalled();
  });
});
