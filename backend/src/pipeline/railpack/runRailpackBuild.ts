import { spawn } from "node:child_process";
import readline from "node:readline";
import { appendLog } from "../../services/logService.js";

function railpackBinary(): string {
  return (process.env.RAILPACK_BIN ?? "railpack").trim() || "railpack";
}

/**
 * Runs `railpack build` in `cwd` and streams lines to the deployment log.
 */
export async function runRailpackBuild(opts: {
  deploymentId: string;
  cwd: string;
  imageTag: string;
  /** When aborted (e.g. build timeout), the railpack process is sent SIGTERM. */
  signal?: AbortSignal;
}): Promise<{ imageTag: string }> {
  const bin = railpackBinary();
  const { deploymentId, cwd, imageTag, signal: cancelSignal } = opts;

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      bin,
      ["build", "--name", imageTag, "--progress", "plain", "."],
      {
        cwd,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    const onAbort = () => {
      if (child.exitCode == null) {
        child.kill("SIGTERM");
      }
    };
    if (cancelSignal) {
      if (cancelSignal.aborted) onAbort();
      else cancelSignal.addEventListener("abort", onAbort, { once: true });
    }

    const onLine = (level: "info" | "error", line: string) => {
      if (!line.trim()) return;
      void appendLog(deploymentId, {
        stage: "build",
        level,
        message: line.length > 8000 ? `${line.slice(0, 8000)}…` : line,
      });
    };

    if (child.stdout) {
      readline.createInterface({ input: child.stdout }).on("line", (line) => onLine("info", line));
    }
    if (child.stderr) {
      readline.createInterface({ input: child.stderr }).on("line", (line) => onLine("error", line));
    }

    child.on("error", (e) => {
      if (cancelSignal) cancelSignal.removeEventListener("abort", onAbort);
      reject(e);
    });
    child.on("close", (code) => {
      if (cancelSignal) cancelSignal.removeEventListener("abort", onAbort);
      if (code === 0) resolve();
      else if (code === null && (cancelSignal?.aborted ?? false)) {
        reject(new Error("railpack was stopped (build cancelled or timeout)"));
      } else {
        reject(new Error(`railpack exited with code ${code}`));
      }
    });
  });

  return { imageTag };
}
