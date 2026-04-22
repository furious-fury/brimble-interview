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
 * Stops log follow, releases the host port in the in-process registry, and removes the container.
 * Safe to call for stub or missing resources.
 */
export async function destroyDeploymentRuntime(deploymentId: string): Promise<void> {
  stopRuntimeLogStream(deploymentId);
  const d = await getDeploymentById(deploymentId);
  if (!d) {
    return;
  }
  if (d.port != null) {
    releaseHostPort(d.port);
  }
  await stopAndRemoveContainer(d.containerId);
}
