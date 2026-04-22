import type { DeploymentStatus } from "../generated/prisma/client.js";
import { getDeploymentById, type DeploymentDTO, patchDeploymentFields } from "../services/deploymentService.js";
import { assertCanTransition } from "./transitions.js";

export async function applyStatusTransition(
  deploymentId: string,
  next: DeploymentStatus
): Promise<DeploymentDTO> {
  const cur = await getDeploymentById(deploymentId);
  if (!cur) {
    throw new Error("Deployment not found");
  }
  const from = cur.status as DeploymentStatus;
  assertCanTransition(from, next);
  if (from === next) {
    return cur;
  }
  const updated = await patchDeploymentFields(deploymentId, { status: next });
  if (!updated) {
    throw new Error("Failed to update deployment status");
  }
  return updated;
}
