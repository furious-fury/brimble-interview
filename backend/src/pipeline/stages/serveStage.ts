import { logger } from "../../config/logger.js";
import { deploymentAppHostname } from "../../deploymentAppHost.js";
import { dynamicDir, registerDeploymentRouteWithReload } from "../../caddyClient.js";
import type { DeployResult, RunResult, StageContext } from "./resultTypes.js";

/**
 * Registers a Caddy site block and returns `http://<vhost>` (port 80 on the host) when
 * CADDY_DYNAMIC_DIR is set; otherwise falls back to a direct `localhost:port` URL.
 */
export async function runServeStage(ctx: StageContext, deploy: DeployResult): Promise<RunResult> {
  const { deployment } = ctx;
  const host = deploymentAppHostname(deployment.name, deployment.id);
  const upstreamHost = (process.env.BRIMBLE_DOCKER_UPSTREAM_HOST ?? "host.docker.internal").replace(/\/$/, "");
  const upstream = `http://${upstreamHost}:${deploy.port}`;

  logger.info({ host, upstream, dynamicDir: dynamicDir ?? "not set" }, "Running serve stage");

  if (dynamicDir) {
    const result = await registerDeploymentRouteWithReload({ host, upstream });
    logger.info({ file: result.file, note: result.note }, "Caddy route registration complete");
    return { url: `http://${host}` };
  }
  const base = (process.env.BRIMBLE_APP_PUBLIC_BASE ?? "http://localhost").replace(/\/$/, "");
  logger.info({ base, port: deploy.port }, "Using direct port URL (no Caddy)");
  return { url: `${base}:${deploy.port}` };
}
