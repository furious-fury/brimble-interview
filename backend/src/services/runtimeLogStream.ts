import { PassThrough } from "node:stream";
import readline from "node:readline";
import { getDocker } from "./dockerClient.js";
import { appendLog } from "./logService.js";

const streams = new Map<string, { stop: () => void }>();

/**
 * Multiplexed container.logs → stdout/stderr → appendLog (stage `runtime`).
 * Fire-and-forget; use {@link stopRuntimeLogStream} before delete/redeploy.
 */
export function startRuntimeLogStream(deploymentId: string, containerId: string): void {
  if (containerId.startsWith("stub-")) {
    return;
  }
  stopRuntimeLogStream(deploymentId);
  const docker = getDocker();
  const container = docker.getContainer(containerId);

  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let raw: NodeJS.ReadableStream & { destroy?: () => void } | undefined;
  let stopped = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    streams.delete(deploymentId);
    try {
      raw?.destroy?.();
    } catch {
      // ignore
    }
    try {
      stdout.destroy();
    } catch {
      // ignore
    }
    try {
      stderr.destroy();
    } catch {
      // ignore
    }
  };
  streams.set(deploymentId, { stop });

  const outRl = readline.createInterface({ input: stdout, crlfDelay: Infinity });
  outRl.on("line", (line) => {
    if (line) void appendLog(deploymentId, { stage: "runtime", level: "info", message: line });
  });
  const errRl = readline.createInterface({ input: stderr, crlfDelay: Infinity });
  errRl.on("line", (line) => {
    if (line) void appendLog(deploymentId, { stage: "runtime", level: "error", message: line });
  });

  void (async () => {
    try {
      const logStream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        tail: 200,
        since: 0,
      });
      raw = logStream;
      if (typeof container.modem.demuxStream === "function") {
        container.modem.demuxStream(logStream, stdout, stderr);
      } else {
        getDocker().modem.demuxStream(logStream, stdout, stderr);
      }
      logStream.on("end", () => {
        if (!stopped) {
          void appendLog(deploymentId, {
            stage: "runtime",
            level: "info",
            message: "Container log stream ended",
          });
        }
        stop();
      });
      logStream.on("error", (e: Error) => {
        void appendLog(deploymentId, {
          stage: "runtime",
          level: "error",
          message: `Log stream error: ${e.message}`,
        });
        stop();
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      void appendLog(deploymentId, { stage: "runtime", level: "error", message: `Log attach failed: ${msg}` });
      stop();
    }
  })();
}

export function stopRuntimeLogStream(deploymentId: string): void {
  streams.get(deploymentId)?.stop();
}
