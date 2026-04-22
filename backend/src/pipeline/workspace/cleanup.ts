import fs from "node:fs";
import { getDeploymentWorkspaceDir } from "./paths.js";

/**
 * Removes the whole deployment workspace under BRIMBLE_WORKSPACE after a build attempt
 * to limit disk growth (Phase 4 plan).
 */
export async function cleanupDeploymentWorkspace(deploymentId: string): Promise<void> {
  const root = getDeploymentWorkspaceDir(deploymentId);
  await fs.promises.rm(root, { recursive: true, force: true });
}
