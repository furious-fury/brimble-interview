import { dynamicDir, registerDeploymentRouteWithReload } from "../../caddyClient.js";
import type { DeployResult, RunResult, StageContext } from "./resultTypes.js";

/**
 * Human-readable vhost, unique per deployment (name slug + id prefix) under BRIMBLE_APPS_BASE_DOMAIN.
 * Example: my-app-a1b2c3d4.localhost
 */
function appHostname(deploymentName: string, deploymentId: string): string {
  const domain = (process.env.BRIMBLE_APPS_BASE_DOMAIN ?? "localhost").replace(/^\./, "").replace(/\/$/, "");
  const safe =
    deploymentName
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "app";
  const short = deploymentId.slice(0, 8);
  return `${safe}-${short}.${domain}`;
}

/**
 * Registers a Caddy site block and returns `http://<vhost>` (port 80 on the host) when
 * CADDY_DYNAMIC_DIR is set; otherwise falls back to a direct `localhost:port` URL.
 */
export async function runServeStage(ctx: StageContext, deploy: DeployResult): Promise<RunResult> {
  const { deployment } = ctx;
  const host = appHostname(deployment.name, deployment.id);
  const upstreamHost = (process.env.BRIMBLE_DOCKER_UPSTREAM_HOST ?? "host.docker.internal").replace(/\/$/, "");
  const upstream = `http://${upstreamHost}:${deploy.port}`;

  if (dynamicDir) {
    await registerDeploymentRouteWithReload({
      host,
      upstream,
      id: deployment.id,
    });
    return { url: `http://${host}` };
  }
  const base = (process.env.BRIMBLE_APP_PUBLIC_BASE ?? "http://localhost").replace(/\/$/, "");
  return { url: `${base}:${deploy.port}` };
}
