import type { DeploymentStatus } from "../generated/prisma/client.js";
import { getDeploymentById, patchDeploymentFields } from "../services/deploymentService.js";
import { appendLog } from "../services/logService.js";
import { isTerminalStatus } from "./transitions.js";
import { applyStatusTransition } from "./state.js";
import { runBuildStage } from "./stages/buildStage.js";
import { runDeployStage, runServeStage } from "./stages/stubStages.js";
import { pipelineEvents } from "./events.js";

const STAGE_TIMEOUT_MS = Number(process.env.PIPELINE_STAGE_TIMEOUT_MS) || 120_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
    }),
  ]);
}

async function failPipeline(deploymentId: string, message: string): Promise<void> {
  const d = await getDeploymentById(deploymentId);
  if (!d) return;
  if (isTerminalStatus(d.status as DeploymentStatus)) return;
  try {
    await applyStatusTransition(deploymentId, "failed");
  } catch {
    await patchDeploymentFields(deploymentId, { status: "failed" });
  }
  await appendLog(deploymentId, {
    stage: "build",
    level: "error",
    message: `Pipeline failed: ${message}`,
  });
  pipelineEvents.emitFailed({ deploymentId, message });
}

export async function runPipeline(deploymentId: string): Promise<void> {
  const initial = await getDeploymentById(deploymentId);
  if (!initial) {
    return;
  }
  if (initial.status !== "pending") {
    return;
  }

  try {
    await appendLog(deploymentId, {
      stage: "build",
      level: "info",
      message: "Pipeline started (orchestration).",
    });

    const afterPending = await applyStatusTransition(deploymentId, "building");
    pipelineEvents.emitTransition({
      deploymentId,
      from: "pending",
      to: "building",
    });
    await appendLog(deploymentId, {
      stage: "build",
      level: "info",
      message: `Status: ${afterPending.status}`,
    });

    const build = await withTimeout(
      runBuildStage({ deployment: afterPending }),
      STAGE_TIMEOUT_MS,
      "build"
    );
    await patchDeploymentFields(deploymentId, { imageTag: build.imageTag });
    await appendLog(deploymentId, {
      stage: "build",
      level: "info",
      message: `Build stage complete. Image: ${build.imageTag}`,
    });

    const afterBuild = await applyStatusTransition(deploymentId, "deploying");
    pipelineEvents.emitTransition({ deploymentId, from: "building", to: "deploying" });
    await appendLog(deploymentId, {
      stage: "deploy",
      level: "info",
      message: `Status: ${afterBuild.status}`,
    });

    const deploy = await withTimeout(
      runDeployStage({ deployment: afterBuild }, build),
      STAGE_TIMEOUT_MS,
      "deploy"
    );
    await patchDeploymentFields(deploymentId, {
      port: deploy.port,
      containerId: deploy.containerId,
    });
    await appendLog(deploymentId, {
      stage: "deploy",
      level: "info",
      message: `Deploy stage complete (stub). Port ${deploy.port}, container ${deploy.containerId}`,
    });

    const d2 = await getDeploymentById(deploymentId);
    if (!d2) return;
    const run = await withTimeout(
      runServeStage({ deployment: d2 }, deploy),
      STAGE_TIMEOUT_MS,
      "serve"
    );
    await patchDeploymentFields(deploymentId, { url: run.url });
    await appendLog(deploymentId, {
      stage: "runtime",
      level: "info",
      message: `Serve stage complete (stub). URL: ${run.url}`,
    });

    const afterDeploy = await applyStatusTransition(deploymentId, "running");
    pipelineEvents.emitTransition({ deploymentId, from: "deploying", to: "running" });
    await appendLog(deploymentId, {
      stage: "runtime",
      level: "info",
      message: `Deployment ${afterDeploy.status}. Replace deploy/serve stubs in Phases 6–7 for production behavior.`,
    });
    pipelineEvents.emitCompleted({ deploymentId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await failPipeline(deploymentId, msg);
  }
}
