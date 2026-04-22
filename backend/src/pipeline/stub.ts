import type { DeploymentDTO } from "../services/deploymentService.js";

/**
 * Phase 3 will run the real build → deploy → run workflow.
 * For Phase 2, this is a no-op hook called after a deployment row is created.
 */
export function enqueueDeploymentStub(deployment: DeploymentDTO): void {
  console.log(
    `[pipeline] (stub) deployment queued: id=${deployment.id} name=${JSON.stringify(deployment.name)} — Phase 3 will start the pipeline`
  );
}
