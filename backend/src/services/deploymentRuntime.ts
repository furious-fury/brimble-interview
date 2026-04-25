import { logger } from "../config/logger.js";
import { removeDeploymentCaddyRoute } from "../caddyClient.js";
import { deploymentAppHostname } from "../deploymentAppHost.js";
import { getDeploymentById } from "./deploymentService.js";
import { getDocker } from "./dockerClient.js";
import { releaseHostPort } from "./portAllocator.js";
import { stopRuntimeLogStream } from "./runtimeLogStream.js";

export async function stopAndRemoveContainer(containerId: string | null | undefined): Promise<void> {
  if (!containerId || containerId.startsWith("stub-")) {
    return;
  }
  const c = getDocker().getContainer(containerId);
  try {
    await c.stop({ t: 10 });
  } catch {
    // not running or already stopped
  }
  try {
    await c.remove({ force: true });
  } catch {
    // already removed
  }
}

/**
 * Remove a Docker image by tag. Safe to call if image doesn't exist.
 */
export async function removeDockerImage(imageTag: string | null | undefined): Promise<void> {
  if (!imageTag) {
    return;
  }
  try {
    const docker = getDocker();
    const image = docker.getImage(imageTag);
    await image.remove({ force: true });
    logger.info({ imageTag }, "Removed Docker image");
  } catch (err) {
    // Image may not exist locally (already removed or never built)
    logger.debug({ imageTag, err }, "Docker image not found or already removed");
  }
}

/**
 * Stops log follow, releases the host port in the in-process registry, removes the container,
 * and cleans up the Docker image to prevent disk space accumulation.
 * Safe to call for stub or missing resources.
 */
export async function destroyDeploymentRuntime(deploymentId: string): Promise<void> {
  stopRuntimeLogStream(deploymentId);
  const d = await getDeploymentById(deploymentId);
  const removed = await removeDeploymentCaddyRoute({
    vhost: d ? deploymentAppHostname(d.name, d.id) : undefined,
    legacyDeploymentId: deploymentId,
  });
  if (!removed.ok) {
    logger.warn({ note: removed.note }, "Caddy route not removed during cleanup");
  }
  if (!d) {
    return;
  }
  if (d.port != null) {
    releaseHostPort(d.port);
  }
  await stopAndRemoveContainer(d.containerId);
  // Remove Docker image to free up disk space
  await removeDockerImage(d.imageTag);
}
