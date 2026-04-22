import type { Deployment, DeploymentStatus } from "../api/types.js";

export function isPipelineInFlight(status: DeploymentStatus): boolean {
  return (
    status === "pending" ||
    status === "building" ||
    status === "deploying"
  );
}

export function listHasInFlight(list: Deployment[]): boolean {
  return list.some((d) => isPipelineInFlight(d.status));
}

export function shouldPollSingle(status: DeploymentStatus): boolean {
  return isPipelineInFlight(status) || status === "running";
}
