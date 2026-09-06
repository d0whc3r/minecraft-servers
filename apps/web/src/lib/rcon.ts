// Minimal Source RCON client (the protocol Minecraft servers speak).
import net from "node:net";

interface RconPacket {
  id: number;
  type: number;
  payload: string;
}

const SERVERDATA_AUTH = 3;
const SERVERDATA_AUTH_RESPONSE = 2;
const SERVERDATA_EXECCOMMAND = 2;
const SERVERDATA_RESPONSE_VALUE = 0;

function buildPacket(id: number, type: number, payload: string): Buffer {
  const body = Buffer.from(payload, "ascii");
  const buf = Buffer.alloc(4 + 4 + 4 + body.length + 2);
  buf.writeInt32LE(4 + 4 + body.length + 2, 0); // length of id+type+body+2 nulls
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  body.copy(buf, 12);
  return buf;
}

function readPacket(buf: Buffer): RconPacket | null {
  if (buf.length < 12) return null;
  const len = buf.readInt32LE(0);
  if (buf.length < 4 + len) return null;
  const id = buf.readInt32LE(4);
  const type = buf.readInt32LE(8);
  const payload = buf.toString("utf8", 12, 4 + len - 2);
  return { id, type, payload };
}

/** Collect socket data until `idleMs` passes with no new bytes. */
function collectUntilIdle(socket: net.Socket, idleMs: number): Promise<void> {
  return new Promise((resolve) => {
    let timer: NodeJS.Timeout | null = setTimeout(resolve, idleMs);
    const onData = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(resolve, idleMs);
    };
    socket.once("close", () => {
      if (timer) clearTimeout(timer);
      resolve();
    });
    socket.on("data", onData);
  });
}

export interface RconResult {
  ok: boolean;
  output: string;
}

export async function rconCommand(
  host: string,
  port: number,
  password: string,
  command: string,
  timeoutMs = 5000,
): Promise<RconResult> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let buffer = Buffer.alloc(0);
    let authed = false;
    let settled = false;

    const finish = (result: RconResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    const handleData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      const packet = readPacket(buffer);
      if (!packet) return;
      if (!authed) {
        if (packet.type === SERVERDATA_AUTH_RESPONSE) {
          if (packet.id === -1)
            return finish({ ok: false, output: "Wrong RCON password" });
          authed = true;
          buffer = Buffer.alloc(0);
          socket.write(buildPacket(2, SERVERDATA_EXECCOMMAND, command));
        }
        return;
      }
      if (packet.type === SERVERDATA_RESPONSE_VALUE && packet.id === 2) {
        // Minecraft sometimes sends a duplicated empty packet after the payload;
        // wait out a short idle window so trailing packets don't error the socket.
        const payload = packet.payload.trim();
        collectUntilIdle(socket, 300).then(() =>
          finish({ ok: true, output: payload || "(no output)" }),
        );
      }
    };

    socket.setTimeout(timeoutMs);
    socket.setNoDelay(true);
    socket.on("connect", () =>
      socket.write(buildPacket(1, SERVERDATA_AUTH, password)),
    );
    socket.on("data", handleData);
    socket.on("timeout", () =>
      finish({
        ok: false,
        output: authed ? "No response from server" : "RCON connection timeout",
      }),
    );
    socket.on("error", (err) =>
      finish({ ok: false, output: `RCON error: ${err.message}` }),
    );
    socket.on("close", () => {
      if (!settled)
        finish({
          ok: false,
          output: "RCON connection closed before responding",
        });
    });

    socket.connect(port, host);
  });
}
