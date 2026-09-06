// Unit tests for the Minecraft Server List Ping against a fake status server.
import net from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pingServer } from "@/lib/ping";

function encodeVarint(value: number): Buffer {
  const bytes: number[] = [];
  let v = value >>> 0;
  do {
    let b = v & 0x7f;
    v >>>= 7;
    if (v !== 0) b |= 0x80;
    bytes.push(b);
  } while (v !== 0);
  return Buffer.from(bytes);
}

function encodeString(s: string): Buffer {
  const payload = Buffer.from(s, "utf8");
  return Buffer.concat([encodeVarint(payload.length), payload]);
}

/** Builds a framed status response packet (packet id 0x00 + JSON string). */
function statusFrame(json: string): Buffer {
  const body = Buffer.concat([Buffer.from([0x00]), encodeString(json)]);
  return Buffer.concat([encodeVarint(body.length), body]);
}

const STATUS = {
  version: { name: "1.21.1" },
  players: {
    online: 3,
    max: 20,
    sample: [{ name: "alice" }, { name: "bob" }],
  },
  description: { text: "A ", extra: [{ text: "test ", bold: true }, "server"] },
};

let server: net.Server;
let port: number;
/** Hostnames seen in incoming handshakes (router-style host routing). */
const seenHosts: string[] = [];

beforeAll(async () => {
  server = net.createServer((socket) => {
    let buf = Buffer.alloc(0);
    socket.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      // Parse the first packet: varint len, varint id, varint protocol,
      // varint-prefixed hostname, u16 port, varint next-state.
      try {
        let pos = 0;
        const readVarint = () => {
          let result = 0;
          let shift = 0;
          for (;;) {
            const b = buf[pos];
            result |= (b & 0x7f) << shift;
            pos++;
            if ((b & 0x80) === 0) break;
            shift += 7;
          }
          return result;
        };
        readVarint(); // packet length
        pos++; // packet id (0x00)
        readVarint(); // protocol version
        const hostLen = readVarint();
        const host = buf.toString("utf8", pos, pos + hostLen);
        seenHosts.push(host);
      } catch {
        /* not enough data yet */
      }
      socket.write(statusFrame(JSON.stringify(STATUS)));
      socket.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as net.AddressInfo).port;
});

afterAll(() => {
  server?.close();
});

describe("pingServer", () => {
  it("parses players, version, MOTD and sample names", async () => {
    const result = await pingServer("127.0.0.1", port, 2500, "vanilla.mc.test");
    // The handshake must carry the routed hostname (mc-router keys on it)
    expect(seenHosts).toContain("vanilla.mc.test");
    expect(result).not.toBeNull();
    expect(result!.playersOnline).toBe(3);
    expect(result!.playersMax).toBe(20);
    expect(result!.versionName).toBe("1.21.1");
    expect(result!.motd).toBe("A test server"); // flattened chat component
    expect(result!.playerSample).toEqual(["alice", "bob"]);
    expect(result!.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result!.favicon).toBeNull();
  });

  it("returns null when nothing is listening on the port", async () => {
    const result = await pingServer("127.0.0.1", 1); // closed port
    expect(result).toBeNull();
  });

  it("reassembles a status response split across TCP chunks", async () => {
    // Server that writes the frame in three pieces: frame length varint,
    // packet id + string length, then the JSON payload.
    const splitter = net.createServer((socket) => {
      socket.on("data", () => {
        const frame = statusFrame(JSON.stringify(STATUS));
        socket.write(frame.subarray(0, 1));
        setTimeout(() => socket.write(frame.subarray(1, 3)), 10);
        setTimeout(() => socket.write(frame.subarray(3)), 20);
        setTimeout(() => socket.end(), 40);
      });
    });
    await new Promise<void>((resolve) =>
      splitter.listen(0, "127.0.0.1", resolve),
    );
    const splitPort = (splitter.address() as net.AddressInfo).port;
    try {
      const result = await pingServer("127.0.0.1", splitPort, 2500);
      expect(result).not.toBeNull();
      expect(result!.playersOnline).toBe(3);
    } finally {
      splitter.close();
    }
  });
});
