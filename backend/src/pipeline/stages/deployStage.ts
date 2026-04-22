import type { Container } from "dockerode";
import { getDocker } from "../../services/dockerClient.js";
import {
  allocateHostPort,
  containerListenPort,
  LABEL_MANAGED,
  releaseHostPort,
} from "../../services/portAllocator.js";
import type { BuildResult, DeployResult, StageContext } from "./resultTypes.js";

const LABEL_DEPLOYMENT_ID = "brimble.deployment.id";

export async function runDeployStage(ctx: StageContext, build: BuildResult): Promise<DeployResult> {
  const docker = getDocker();
  const deploymentId = ctx.deployment.id;
  const cPort = containerListenPort();
  const image = build.imageTag;
  const hostPort = allocateHostPort();
  let releaseOnError = true;
  let created: Container | undefined;

  try {
    created = await docker.createContainer({
      Image: image,
      Labels: {
        [LABEL_MANAGED]: "true",
        [LABEL_DEPLOYMENT_ID]: deploymentId,
      },
      ExposedPorts: { [`${cPort}/tcp`]: {} },
      HostConfig: {
        PortBindings: {
          [`${cPort}/tcp`]: [{ HostIp: "0.0.0.0", HostPort: String(hostPort) }],
        },
        RestartPolicy: { Name: "unless-stopped" },
      },
    });

    await created.start();
    const inspect = await docker.getContainer(created.id).inspect();
    if (!inspect.State.Running) {
      throw new Error(
        `Container not running after start: ${inspect.State?.Status ?? "unknown"} (exit: ${inspect.State?.ExitCode})`
      );
    }
    releaseOnError = false;
    return {
      port: hostPort,
      containerId: inspect.Id,
    };
  } catch (e) {
    if (created) {
      try {
        await docker.getContainer(created.id).remove({ force: true });
      } catch {
        // ignore
      }
    }
    if (releaseOnError) {
      releaseHostPort(hostPort);
    }
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Deploy failed: ${msg}`);
  }
}
