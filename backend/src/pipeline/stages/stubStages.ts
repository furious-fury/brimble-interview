import type { DeploymentDTO } from "../../services/deploymentService.js";

export type BuildResult = {
  imageTag: string;
};

export type DeployResult = {
  port: number;
  containerId: string;
};

export type RunResult = {
  url: string;
};

export type StageContext = {
  deployment: DeploymentDTO;
};

/**
 * Phase 6 will start Docker. Placeholder port in range 10000–19999 (see IMPLEMENTATION_PLAN notes).
 */
export async function runDeployStage(ctx: StageContext, _build: BuildResult): Promise<DeployResult> {
  const hash = [...ctx.deployment.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const port = 10000 + (hash % 1000);
  return { port, containerId: `stub-${ctx.deployment.id.slice(0, 12)}` };
}

/**
 * Phase 7 will set real Caddy URL. Placeholder for demo list + detail.
 */
export async function runServeStage(ctx: StageContext, _deploy: DeployResult): Promise<RunResult> {
  const safe = ctx.deployment.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 40) || "app";
  return { url: `http://${safe}.localhost` };
}
