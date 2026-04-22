import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_UNIX = "/data/work";

export function getBrimbleWorkspaceRoot(): string {
  const raw = process.env.BRIMBLE_WORKSPACE?.trim();
  if (raw) {
    return path.resolve(raw);
  }
  if (process.platform === "win32") {
    return path.join(os.tmpdir(), "brimble-work");
  }
  return DEFAULT_UNIX;
}

export function getDeploymentWorkspaceDir(deploymentId: string): string {
  return path.join(getBrimbleWorkspaceRoot(), deploymentId);
}

export function getExtractedSourceDir(deploymentId: string): string {
  return path.join(getDeploymentWorkspaceDir(deploymentId), "source");
}

export function ensureDirSync(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}
