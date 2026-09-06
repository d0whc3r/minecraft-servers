// Minecraft Server List Ping (modern protocol, 1.7+): pure Node, no deps.
import net from "node:net";

export interface PingResult {
  latencyMs: number;
  motd: string | null;
  versionName: string | null;
  playersOnline: number;
  playersMax: number;
  playerSample: string[];
  favicon: string | null;
}

function encodeVarint(value: number): Buffer {
  const bytes: number[] = [];
  let v = value >>> 0; // treat as unsigned 32-bit
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

function frame(payload: Buffer): Buffer {
  return Buffer.concat([encodeVarint(payload.length), payload]);
}

class Reader {
  private buf: Buffer = Buffer.alloc(0);
  private offset = 0;
  push(chunk: Buffer) {
    this.buf = this.offset === 0 ? Buffer.concat([this.buf, chunk]) : chunk;
    this.offset = 0;
  }
  /** Snapshot of the unconsumed bytes. */
  slice(): Buffer {
    return this.buf.subarray(this.offset);
  }
  get available(): number {
    return this.buf.length - this.offset;
  }
  readVarint(): number | null {
    let result = 0;
    let shift = 0;
    let pos = this.offset;
    for (;;) {
      if (pos >= this.buf.length) return null;
      const b = this.buf[pos];
      result |= (b & 0x7f) << shift;
      pos++;
      if ((b & 0x80) === 0) break;
      shift += 7;
      if (shift > 35) return null;
    }
    this.offset = pos;
    return result;
  }
  readString(): string | null {
    const len = this.readVarint();
    if (len === null || len < 0 || this.available < len) return null;
    const s = this.buf.toString("utf8", this.offset, this.offset + len);
    this.offset += len;
    return s;
  }
}

/** Flattens a chat component (string | object with text/extra) to plain text. */
function flattenText(component: unknown): string {
  if (component == null) return "";
  if (typeof component === "string") return component;
  if (Array.isArray(component)) return component.map(flattenText).join("");
  if (typeof component === "object") {
    const obj = component as Record<string, unknown>;
    let text = typeof obj.text === "string" ? obj.text : "";
    if (!text && typeof obj.translate === "string") text = obj.translate;
    return text + flattenText(obj.extra);
  }
  return "";
}

export function pingServer(
  host: string,
  port: number,
  timeoutMs = 2500,
  /** Hostname written into the handshake; defaults to `host`. Used to ping
   *  a specific server through mc-router (host-based routing). */
  handshakeHost = host,
): Promise<PingResult | null> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const reader = new Reader();
    let started = 0;
    let done = false;

    const finish = (result: PingResult | null) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.setNoDelay(true);

    const handshake = frame(
      Buffer.concat([
        Buffer.from([0x00]),
        encodeVarint(0xffff_ffff), // protocol = -1 (unknown)
        encodeString(handshakeHost),
        (() => {
          const b = Buffer.alloc(2);
          b.writeUInt16BE(port);
          return b;
        })(),
        encodeVarint(1), // next state: status
      ]),
    );
    const request = frame(Buffer.from([0x00]));

    socket.once("connect", () => {
      socket.write(handshake);
      started = Date.now();
      socket.write(request);
    });

    socket.on("data", (chunk) => {
      reader.push(chunk);
      if (!reader.available) return;
      // Probe the frame from a snapshot without consuming the stream reader.
      const probe = new Reader();
      probe.push(Buffer.from(reader.slice()));
      const total = probe.readVarint();
      if (total === null || probe.available < total) return; // wait for more data
      const packetId = probe.readVarint();
      if (packetId !== 0) finish(null);
      const json = probe.readString();
      if (!json) return finish(null);
      try {
        const parsed = JSON.parse(json) as Record<string, unknown>;
        const players = (parsed.players ?? {}) as Record<string, unknown>;
        const sample = Array.isArray(players.sample)
          ? (players.sample as Array<Record<string, unknown>>)
              .map((p) => String(p.name ?? ""))
              .filter(Boolean)
          : [];
        finish({
          latencyMs: Date.now() - started,
          motd: flattenText(parsed.description) || null,
          versionName:
            typeof (parsed.version as Record<string, unknown>)?.name ===
            "string"
              ? ((parsed.version as Record<string, unknown>).name as string)
              : null,
          playersOnline: Number(players.online ?? 0),
          playersMax: Number(players.max ?? 0),
          playerSample: sample,
          favicon: typeof parsed.favicon === "string" ? parsed.favicon : null,
        });
      } catch {
        finish(null);
      }
    });

    socket.on("timeout", () => finish(null));
    socket.on("error", () => finish(null));
    socket.on("close", () => finish(null));

    socket.connect(port, host);
  });
}
