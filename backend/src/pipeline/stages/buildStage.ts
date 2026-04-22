import fs from "node:fs";
import path from "node:path";
import { appendLog } from "../../services/logService.js";
import { runRailpackBuild } from "../railpack/runRailpackBuild.js";
import { cleanupDeploymentWorkspace } from "../workspace/cleanup.js";
import { gitCloneToWorkspace } from "../workspace/gitClone.js";
import { getExtractedSourceDir } from "../workspace/paths.js";
import type { BuildResult, StageContext } from "./resultTypes.js";

function imageRefFor(deploymentId: string): string {
  return `brimble/d-${deploymentId}:v1`;
}

export async function runBuildStage(ctx: StageContext): Promise<BuildResult> {
  const { deployment } = ctx;
  const id = deployment.id;
  const imageTag = imageRefFor(id);

  try {
    if (deployment.sourceType === "git") {
      const ref = deployment.sourceRef?.trim() || "main";
      if (deployment.source.startsWith("git@")) {
        await appendLog(id, {
          stage: "build",
          level: "info",
          message: `Cloning ${deployment.source} (ref: ${ref}) over SSH (requires key on host)…`,
        });
      } else {
        await appendLog(id, {
          stage: "build",
          level: "info",
          message: `Cloning ${deployment.source} (ref: ${ref})…`,
        });
      }
      await gitCloneToWorkspace(deployment.source, ref, id);
    } else if (deployment.sourceType === "upload") {
      if (deployment.source === "pending") {
        throw new Error("Upload source is not ready (still pending)");
      }
      const abs = path.resolve(deployment.source);
      if (!fs.existsSync(abs)) {
        throw new Error(`Upload path not found: ${abs}`);
      }
      if (!fs.statSync(abs).isDirectory()) {
        throw new Error(`Upload path is not a directory: ${abs}`);
      }
    } else {
      throw new Error("Unsupported source type for build");
    }

    const cwd =
      deployment.sourceType === "git" ? getExtractedSourceDir(id) : path.resolve(deployment.source);

    await appendLog(id, {
      stage: "build",
      level: "info",
      message: `Running railpack in ${cwd} (image: ${imageTag})`,
    });

    return await runRailpackBuild({ deploymentId: id, cwd, imageTag });
  } finally {
    try {
      await cleanupDeploymentWorkspace(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      void appendLog(id, {
        stage: "build",
        level: "warn",
        message: `Workspace cleanup warning: ${msg}`,
      });
    }
  }
}
