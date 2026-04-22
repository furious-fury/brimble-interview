import { getDocker } from "./dockerClient.js";

const LABEL_MANAGED = "brimble.managed";

function hostPortMin(): number {
  return Number(process.env.BRIMBLE_HOST_PORT_MIN) || 10_000;
}

function hostPortMax(): number {
  return Number(process.env.BRIMBLE_HOST_PORT_MAX) || 11_000;
}

const usedHostPorts = new Set<number>();

export function containerListenPort(): number {
  return Number(process.env.BRIMBLE_CONTAINER_PORT) || 3000;
}

export function allocateHostPort(): number {
  const min = hostPortMin();
  const max = hostPortMax();
  for (let p = min; p <= max; p++) {
    if (!usedHostPorts.has(p)) {
      usedHostPorts.add(p);
      return p;
    }
  }
  throw new Error(`No free host port in range ${min}-${max}`);
}

export function releaseHostPort(port: number): void {
  usedHostPorts.delete(port);
}

/**
 * After restart, repopulate `usedHostPorts` from running containers we own.
 */
export async function initPortRegistryFromDocker(): Promise<void> {
  const docker = getDocker();
  const list = await docker.listContainers({ all: true });
  for (const c of list) {
    if (c.Labels?.[LABEL_MANAGED] !== "true") continue;
    for (const pub of c.Ports ?? []) {
      if (pub.PublicPort) {
        usedHostPorts.add(pub.PublicPort);
      }
    }
  }
}

export { LABEL_MANAGED };
