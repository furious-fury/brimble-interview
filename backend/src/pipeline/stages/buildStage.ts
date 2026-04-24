import fs from "node:fs";
import path from "node:path";
import { appendLog } from "../../services/logService.js";
import { runRailpackBuild } from "../railpack/runRailpackBuild.js";
import { cleanupDeploymentWorkspace } from "../workspace/cleanup.js";
import { gitCloneToWorkspace } from "../workspace/gitClone.js";
import { getExtractedSourceDir } from "../workspace/paths.js";
import { detectConfigIssues } from "../frameworkCheckers.js";
import { validateBuildOutput } from "../buildValidation.js";
import { PIPELINE_CONSTANTS } from "../../config/constants.js";
import type { BuildResult, StageContext } from "./resultTypes.js";

function imageRefFor(deploymentId: string): string {
  return `brimble/d-${deploymentId}:v1`;
}

/**
 * Logs issues detected during pre-build configuration validation.
 */
async function logConfigIssues(deploymentId: string, issues: string[]): Promise<void> {
  for (const issue of issues) {
    await appendLog(deploymentId, {
      stage: "build",
      level: "warn",
      message: issue,
    });
  }
}

/**
 * Applies auto-fixes and stores revert functions for later cleanup.
 */
async function applyAutoFixes(
  deploymentId: string,
  autoFixes: Array<{
    description: string;
    apply: () => void;
    revert: () => void;
  }>
): Promise<Array<{ description: string; revert: () => void }>> {
  const appliedFixes: Array<{ description: string; revert: () => void }> = [];

  for (const fix of autoFixes) {
    await appendLog(deploymentId, {
      stage: "build",
      level: "info",
      message: `🔧 ${fix.description}`,
    });
    fix.apply();
    appliedFixes.push({ description: fix.description, revert: fix.revert });
  }

  return appliedFixes;
}

/**
 * Reverts all applied auto-fixes after build completes (success or failure).
 */
async function revertAutoFixes(
  deploymentId: string,
  appliedFixes: Array<{ description: string; revert: () => void }>
): Promise<void> {
  for (const fix of appliedFixes) {
    try {
      fix.revert();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await appendLog(deploymentId, {
        stage: "build",
        level: "warn",
        message: `Failed to revert auto-fix (${fix.description}): ${msg}`,
      });
    }
  }
}

/**
 * Cleans up workspace and logs any errors (non-fatal).
 */
async function cleanupWithLogging(deploymentId: string): Promise<void> {
  try {
    await cleanupDeploymentWorkspace(deploymentId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await appendLog(deploymentId, {
      stage: "build",
      level: "warn",
      message: `Workspace cleanup warning: ${msg}`,
    });
  }
}

/**
 * Logs the appropriate message for git clone based on URL type.
 */
async function logCloneStart(
  deploymentId: string,
  source: string,
  ref: string
): Promise<void> {
  const isSsh = source.startsWith("git@");
  const message = isSsh
    ? `Cloning ${source} (ref: ${ref}) over SSH (requires key on host)…`
    : `Cloning ${source} (ref: ${ref})…`;

  await appendLog(deploymentId, {
    stage: "build",
    level: "info",
    message,
  });
}

/**
 * Validates the source is ready for building.
 */
function validateSource(source: string): void {
  const abs = path.resolve(source);
  if (!fs.existsSync(abs)) {
    throw new Error(`Upload path not found: ${abs}`);
  }
  if (!fs.statSync(abs).isDirectory()) {
    throw new Error(`Upload path is not a directory: ${abs}`);
  }
}

export async function runBuildStage(ctx: StageContext): Promise<BuildResult> {
  const { deployment } = ctx;
  const id = deployment.id;
  const imageTag = imageRefFor(id);
  let appliedFixes: Array<{ description: string; revert: () => void }> = [];

  try {
    // Handle different source types
    if (deployment.sourceType === "git") {
      const ref = deployment.sourceRef?.trim() || PIPELINE_CONSTANTS.DEFAULT_BRANCH;
      await logCloneStart(id, deployment.source, ref);
      await gitCloneToWorkspace(deployment.source, ref, id);
    } else if (deployment.sourceType === "upload") {
      if (deployment.source === "pending") {
        throw new Error("Upload source is not ready (still pending)");
      }
      validateSource(deployment.source);
    } else {
      throw new Error("Unsupported source type for build");
    }

    const cwd =
      deployment.sourceType === "git"
        ? getExtractedSourceDir(id)
        : path.resolve(deployment.source);

    // Pre-build validation: detect framework misconfigurations
    const { issues, autoFixes } = detectConfigIssues(cwd);
    await logConfigIssues(id, issues);
    appliedFixes = await applyAutoFixes(id, autoFixes);

    await appendLog(id, {
      stage: "build",
      level: "info",
      message: `Running railpack in ${cwd} (image: ${imageTag})`,
    });

    const result = await runRailpackBuild({
      deploymentId: id,
      cwd,
      imageTag,
      signal: ctx.abortSignal,
    });

    // Post-build validation: verify expected outputs exist
    const validation = await validateBuildOutput(id, cwd);
    if (!validation.valid) {
      await appendLog(id, {
        stage: "build",
        level: "error",
        message: validation.error!,
      });
      throw new Error(validation.error);
    }

    return result;
  } finally {
    // Always cleanup: revert fixes, then workspace
    await revertAutoFixes(id, appliedFixes);
    await cleanupWithLogging(id);
  }
}
