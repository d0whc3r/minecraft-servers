// Unit tests for the Source RCON client against a fake RCON server.
import net from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rconCommand } from "@/lib/rcon";

const PASSWORD = "test-password";

function buildPacket(id: number, type: number, payload: string): Buffer {
  const body = Buffer.from(payload, "ascii");
  const buf = Buffer.alloc(4 + 4 + 4 + body.length + 2);
  buf.writeInt32LE(4 + 4 + body.length + 2, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  body.copy(buf, 12);
  return buf;
}

/** Minimal RCON server: auth + echoes commands back. */
function startRconServer(
  authFail = false,
): Promise<{ server: net.Server; port: number }> {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      let buffer = Buffer.alloc(0);
      const authed = () => !authFail;
      socket.on("data", (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        for (;;) {
          if (buffer.length < 12) return;
          const len = buffer.readInt32LE(0);
          if (buffer.length < 4 + len) return;
          const id = buffer.readInt32LE(4);
          const type = buffer.readInt32LE(8);
          const payload = buffer.toString("utf8", 12, 4 + len - 2);
          buffer = buffer.subarray(4 + len);

          if (type === 3) {
            // SERVERDATA_AUTH
            if (authFail) {
              socket.write(buildPacket(-1, 2, ""));
            } else {
              socket.write(buildPacket(id, 2, ""));
              socket.write(buildPacket(id, 0, "")); // value string ack
            }
          } else if (type === 2 && authed()) {
            // SERVERDATA_EXECCOMMAND
            socket.write(buildPacket(id, 0, `echo:${payload}`));
          }
        }
      });
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({
        server,
        port: (server.address() as net.AddressInfo).port,
      });
    });
  });
}

let rconOk: { server: net.Server; port: number };
let rconBad: { server: net.Server; port: number };

beforeAll(async () => {
  rconOk = await startRconServer(false);
  rconBad = await startRconServer(true);
});

afterAll(() => {
  rconOk?.server.close();
  rconBad?.server.close();
});

describe("rconCommand", () => {
  it("authenticates and returns the command output", async () => {
    const res = await rconCommand("127.0.0.1", rconOk.port, PASSWORD, "list");
    expect(res.ok).toBe(true);
    expect(res.output).toBe("echo:list");
  });

  it("reports an authentication failure", async () => {
    const res = await rconCommand("127.0.0.1", rconBad.port, PASSWORD, "list");
    expect(res.ok).toBe(false);
    expect(res.output).toBe("Wrong RCON password");
  });

  it("fails cleanly when the port is closed", async () => {
    const res = await rconCommand("127.0.0.1", 1, PASSWORD, "list");
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/^RCON error:/);
  });
});
