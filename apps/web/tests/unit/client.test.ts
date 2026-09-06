// Pure helper functions used by the React islands.
import { describe, expect, it } from "vitest";
import { formatBytes, formatUptime, timeAgo } from "../../src/lib/client";

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
