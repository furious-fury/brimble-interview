import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import readline from "node:readline";
import { appendLog } from "../../services/logService.js";

function railpackBinary(): string {
  return (process.env.RAILPACK_BIN ?? "railpack").trim() || "railpack";
}

function buildctlBinary(): string {
  return (process.env.BUILDKIT_CTL_BIN ?? "buildctl").trim() || "buildctl";
}

function registryPushHost(): string {
  return (process.env.BRIMBLE_REGISTRY_PUSH_HOST ?? "").trim() || "registry:5000";
}

function registryPullHost(): string {
  return (process.env.BRIMBLE_REGISTRY_PULL_HOST ?? "").trim() || "127.0.0.1:5000";
}

function toRegistryRef(host: string, image: string): string {
  // If image already includes a registry host, leave it.
  if (image.includes("/") && image.split("/")[0]?.includes(".")) return image;
  if (image.includes("/") && image.split("/")[0]?.includes(":")) return image;
  return `${host}/${image}`;
}

async function inferContainerPortFromPlan(planPath: string): Promise<number | null> {
  try {
    const raw = await fs.readFile(planPath, "utf8");
    const plan = JSON.parse(raw) as any;
    const startCommand: unknown =
      plan?.deploy?.startCommand ??
      plan?.deploy?.start_command ??
      plan?.deploy?.start ??
      plan?.deploy?.cmd;

    if (typeof startCommand === "string") {
      // Railpack static site plans typically run Caddy on :80.
      if (startCommand.includes("caddy") && startCommand.includes("run")) return 80;
    }
  } catch {
    // ignore
  }
  return null;
}

async function streamChildLines(opts: {
  deploymentId: string;
  cwd: string;
  label: string;
  cmd: string;
  args: string[];
  signal?: AbortSignal;
  /** When stderr is only progress (e.g. buildctl, BuildKit), avoid logging as `error`. */
  stderrLogLevel?: "info" | "error";
}): Promise<void> {
  const { deploymentId, cwd, label, cmd, args, signal, stderrLogLevel = "error" } = opts;

  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const onAbort = () => {
      if (child.exitCode == null) child.kill("SIGTERM");
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }

    const onLine = (level: "info" | "error", line: string) => {
      if (!line.trim()) return;
      void appendLog(deploymentId, {
        stage: "build",
        level,
        message: `[${label}] ${line.length > 7800 ? `${line.slice(0, 7800)}…` : line}`,
      });
    };

    if (child.stdout) {
      readline.createInterface({ input: child.stdout }).on("line", (line) => onLine("info", line));
    }
    if (child.stderr) {
      readline
        .createInterface({ input: child.stderr })
        .on("line", (line) => onLine(stderrLogLevel, line));
    }

    child.on("error", (e) => {
      if (signal) signal.removeEventListener("abort", onAbort);
      reject(e);
    });
    child.on("close", (code) => {
      if (signal) signal.removeEventListener("abort", onAbort);
      if (code === 0) resolve();
      else if (code === null && (signal?.aborted ?? false)) {
        reject(new Error(`${label} was stopped (build cancelled or timeout)`));
      } else {
        reject(new Error(`${label} exited with code ${code}`));
      }
    });
  });
}

/**
 * Builds an image with Railpack, pushing it to a local registry instead of
 * exporting to the Docker daemon (avoids BuildKit `sending tarball` / `docker load` hangs).
 */
export async function runRailpackBuild(opts: {
  deploymentId: string;
  cwd: string;
  imageTag: string;
  /** When aborted (e.g. build timeout), the railpack process is sent SIGTERM. */
  signal?: AbortSignal;
}): Promise<{ imageTag: string; containerPort: number }> {
  const railpack = railpackBinary();
  const buildctl = buildctlBinary();
  const { deploymentId, cwd, imageTag, signal } = opts;

  const pushRef = toRegistryRef(registryPushHost(), imageTag);
  const pullRef = toRegistryRef(registryPullHost(), imageTag);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "brimble-railpack-"));
  const planName = "railpack-plan.json";
  const planPath = path.join(tmpDir, planName);
  let containerPort = Number(process.env.BRIMBLE_CONTAINER_PORT) || 3000;

  try {
    await appendLog(deploymentId, {
      stage: "build",
      level: "info",
      message: `Build output: push ${pushRef} (run as ${pullRef})`,
    });

    await streamChildLines({
      deploymentId,
      cwd,
      label: "railpack",
      cmd: railpack,
      args: ["prepare", ".", "--plan-out", planPath],
      signal,
    });

    const inferredPort = await inferContainerPortFromPlan(planPath);
    containerPort = inferredPort ?? containerPort;
    await appendLog(deploymentId, {
      stage: "build",
      level: "info",
      message: `Container port: ${containerPort}`,
    });

    const addr = (process.env.BUILDKIT_HOST ?? "").trim();
    if (!addr) throw new Error("BUILDKIT_HOST is not set");

    await streamChildLines({
      deploymentId,
      cwd,
      label: "buildctl",
      stderrLogLevel: "info",
      cmd: buildctl,
      args: [
        "--addr",
        addr,
        "build",
        "--local",
        `context=${cwd}`,
        "--local",
        `dockerfile=${tmpDir}`,
        "--frontend",
        "gateway.v0",
        "--opt",
        "source=ghcr.io/railwayapp/railpack-frontend",
        "--opt",
        `filename=${planName}`,
        "--output",
        `type=image,name=${pushRef},push=true`,
        "--progress",
        "plain",
      ],
      signal,
    });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }

  return { imageTag: pullRef, containerPort };
}
