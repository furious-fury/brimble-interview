import Docker from "dockerode";

let docker: Docker | null = null;

/**
 * Default: Unix socket in Linux containers; named pipe on Windows (Docker Desktop).
 * Override with `DOCKER_SOCKET_PATH`.
 */
function createDocker(): Docker {
  const socketPath =
    process.env.DOCKER_SOCKET_PATH?.trim() ||
    (process.platform === "win32" ? "\\\\.\\pipe\\docker_engine" : "/var/run/docker.sock");
  return new Docker({ socketPath });
}

export function getDocker(): Docker {
  if (!docker) {
    docker = createDocker();
  }
  return docker;
}

export async function pingDocker(): Promise<void> {
  const d = getDocker();
  await d.ping();
}
