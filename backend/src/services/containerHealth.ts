import { prisma } from "../db/prisma.js";
import { getDocker } from "./dockerClient.js";
import { applyStatusTransition } from "../pipeline/state.js";
import { appendLog } from "./logService.js";
import { getDeploymentById, patchDeploymentFields } from "./deploymentService.js";
import { destroyDeploymentRuntime } from "./deploymentRuntime.js";

const MS = Number(process.env.BRIMBLE_HEALTH_POLL_MS) || 15_000;

export function startContainerHealthLoop(): void {
  setInterval(() => {
    void runHealthOnce();
  }, MS);
}

async function runHealthOnce(): Promise<void> {
  const rows = await prisma.deployment.findMany({
    where: { status: "running", containerId: { not: null } },
    select: { id: true, containerId: true },
  });
  for (const row of rows) {
    if (!row.containerId || row.containerId.startsWith("stub-")) {
      continue;
    }
    try {
      const info = await getDocker().getContainer(row.containerId).inspect();
      if (info.State.Running) {
        continue;
      }
      const st = info.State?.Status ?? "unknown";
      const code = info.State?.ExitCode ?? "n/a";
      const d = await getDeploymentById(row.id);
      if (!d || d.status !== "running") {
        continue;
      }
      await appendLog(row.id, {
        stage: "runtime",
        level: "error",
        message: `Container stopped unexpectedly (status=${st}, exit=${code})`,
      });
      await destroyDeploymentRuntime(row.id);
      try {
        await applyStatusTransition(row.id, "failed");
      } catch {
        await patchDeploymentFields(row.id, { status: "failed" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const is404 = /404|no such container|NotFound/i.test(msg);
      if (!is404) {
        continue;
      }
      const d = await getDeploymentById(row.id);
      if (!d || d.status !== "running") {
        continue;
      }
      await appendLog(row.id, {
        stage: "runtime",
        level: "error",
        message: "Container no longer exists (removed externally)",
      });
      await destroyDeploymentRuntime(row.id);
      try {
        await applyStatusTransition(row.id, "failed");
      } catch {
        await patchDeploymentFields(row.id, { status: "failed" });
      }
    }
  }
}
