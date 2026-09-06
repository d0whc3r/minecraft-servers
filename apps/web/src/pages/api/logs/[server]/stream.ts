// Live log stream over Server-Sent Events (docker/kubectl logs -f).
import type { APIRoute } from "astro";
import { spawn } from "node:child_process";
import { guardAuth, apiError, getServerParam } from "@/lib/api.js";
import { backend } from "@/lib/backend.js";

export const prerender = false;

// eslint-disable-next-line no-control-regex
const ANSI_REGEX =
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g;

export const GET: APIRoute = async (context) => {
  const denied = guardAuth(context);
  if (denied) return denied;
  const server = getServerParam(context);
  if (!server) return apiError("Unknown server", 404);

  const container = `mc-${server}`;
  const encoder = new TextEncoder();
  let child: ReturnType<typeof spawn> | null = null;
  const { cmd, args } = backend.logFollow(server);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: string, data: string) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          closed = true;
        }
      };

      send("hello", `following logs of ${container}…`);

      child = spawn(cmd, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      // Carry a partial line across chunk boundaries so one log line is
      // never split into two SSE events.
      let pending = "";
      const onData = (buf: Buffer) => {
        pending += buf.toString("utf8").replace(ANSI_REGEX, "");
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) {
          if (line) send("log", line);
        }
      };
      child.stdout?.on("data", onData);
      child.stderr?.on("data", onData);
      child.on("error", (err) =>
        send("error", `Failed to run docker logs: ${err.message}`),
      );
      child.on("close", (code) => {
        if (pending) {
          send("log", pending);
          pending = "";
        }
        send(
          "end",
          code === null || code === 0
            ? "stream ended"
            : `log stream exited with code ${code}`,
        );
        closeStream();
      });

      const closeStream = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      context.request.signal.addEventListener("abort", () => {
        child?.kill("SIGTERM");
        closeStream();
      });
    },
    cancel() {
      child?.kill("SIGTERM");
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
};
