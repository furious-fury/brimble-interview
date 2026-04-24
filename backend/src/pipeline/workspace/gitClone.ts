import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { GIT_CONSTANTS } from "../../config/constants.js";
import { getDeploymentWorkspaceDir, getExtractedSourceDir, ensureDirSync } from "./paths.js";

const execFileAsync = promisify(execFile);

function injectHttpsToken(remoteUrl: string, token: string | undefined): string {
  if (!token) return remoteUrl;
  if (!remoteUrl.startsWith("https://")) return remoteUrl;
  try {
    const u = new URL(remoteUrl);
    u.username = "x-access-token";
    u.password = token;
    return u.toString();
  } catch {
    return remoteUrl;
  }
}

export async function gitCloneToWorkspace(
  remoteUrl: string,
  ref: string,
  deploymentId: string
): Promise<void> {
  const workRoot = getDeploymentWorkspaceDir(deploymentId);
  const dest = getExtractedSourceDir(deploymentId);
  ensureDirSync(workRoot);
  await fs.promises.rm(dest, { recursive: true, force: true });

  const token = process.env.GIT_TOKEN?.trim();
  const cloneUrl = injectHttpsToken(remoteUrl, token);
  const args = ["clone", "--depth", "1", "-b", ref, cloneUrl, dest];
  await execFileAsync("git", args, {
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    maxBuffer: GIT_CONSTANTS.MAX_BUFFER_SIZE,
  });
}
