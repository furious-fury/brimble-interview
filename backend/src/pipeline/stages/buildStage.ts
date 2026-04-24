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

interface ConfigCheckResult {
  issues: string[];
  autoFixes: Array<{
    description: string;
    apply: () => void;
    revert: () => void;
  }>;
}

/**
 * Framework-specific configuration checkers.
 * Each returns issues and optional auto-fixes.
 */
const FRAMEWORK_CHECKERS: Record<string, (cwd: string, content: string, configPath: string) => ConfigCheckResult> = {
  // Next.js: output: 'export' creates static HTML incompatible with 'next start'
  nextjs: (cwd, content, configPath) => {
    const issues: string[] = [];
    const autoFixes: ConfigCheckResult["autoFixes"] = [];
    const basename = path.basename(configPath);

    // Check for output: 'export' which creates static HTML not server
    if (content.includes("output:") && /['"]export['"]/.test(content)) {
      issues.push(
        `⚠️ Detected Next.js 'output: "export"' mode. This creates static HTML files incompatible with containerized deployment.`
      );

      const backupPath = `${configPath}.backup`;
      autoFixes.push({
        description: `Auto-fixing ${basename}: temporarily removing 'output: "export"' for containerized build`,
        apply: () => {
          if (!fs.existsSync(backupPath)) {
            fs.copyFileSync(configPath, backupPath);
            // Remove output: 'export' line
            const fixed = content
              .split('\n')
              .filter(line => !line.match(/output:\s*['"]export['"]/))
              .join('\n');
            fs.writeFileSync(configPath, fixed);
          }
        },
        revert: () => {
          if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, configPath);
            fs.unlinkSync(backupPath);
          }
        },
      });
    }

    // Check for distDir that might conflict
    if (content.includes("distDir:") && /['"]dist['"]/.test(content)) {
      issues.push(
        `ℹ️ Detected custom 'distDir: "dist"'. Ensure this matches your build output. ` +
          `Default Next.js output is '.next/' which works best with containers.`
      );
    }

    return { issues, autoFixes };
  },

  // SvelteKit: needs adapter for Node.js container
  sveltekit: (cwd, content, configPath) => {
    const issues: string[] = [];
    const autoFixes: ConfigCheckResult["autoFixes"] = [];
    const basename = path.basename(configPath);

    // Check if using static adapter (creates static files, not server)
    if (content.includes("@sveltejs/adapter-static") || content.includes("adapter: static")) {
      issues.push(
        `⚠️ Detected SvelteKit with static adapter. This creates static HTML files. ` +
          `Use '@sveltejs/adapter-node' for containerized server deployment, ` +
          `or '@sveltejs/adapter-auto' to let Railpack choose the best adapter.`
      );
    }

    return { issues, autoFixes };
  },

  // Nuxt: check nitro preset for static vs server
  nuxt: (cwd, content, configPath) => {
    const issues: string[] = [];
    const autoFixes: ConfigCheckResult["autoFixes"] = [];
    const basename = path.basename(configPath);

    // Check for static preset
    if (content.includes("nitro:") && /preset:\s*['"]static['"]/.test(content)) {
      issues.push(
        `⚠️ Detected Nuxt with 'nitro: { preset: "static" }'. This creates static HTML files. ` +
          `Remove the static preset or set to 'node-server' for containerized deployment.`
      );
    }

    return { issues, autoFixes };
  },
};

/**
 * Detect common framework misconfigurations that cause runtime failures.
 * Returns warnings and auto-fixes to apply before build starts.
 */
function detectConfigIssues(cwd: string): ConfigCheckResult {
  const issues: string[] = [];
  const autoFixes: ConfigCheckResult["autoFixes"] = [];

  // Framework detection: check config files in priority order
  const frameworkConfigs: Array<{ framework: string; files: string[] }> = [
    {
      framework: "nextjs",
      files: ["next.config.ts", "next.config.js", "next.config.mjs"],
    },
    {
      framework: "sveltekit",
      files: ["svelte.config.js", "svelte.config.ts"],
    },
    {
      framework: "nuxt",
      files: ["nuxt.config.ts", "nuxt.config.js"],
    },
  ];

  for (const { framework, files } of frameworkConfigs) {
    for (const file of files) {
      const configPath = path.join(cwd, file);
      if (fs.existsSync(configPath)) {
        try {
          const content = fs.readFileSync(configPath, "utf-8");
          const checker = FRAMEWORK_CHECKERS[framework];
          if (checker) {
            const result = checker(cwd, content, configPath);
            issues.push(...result.issues);
            autoFixes.push(...result.autoFixes);
          }
        } catch {
          // Ignore read errors
        }
        break; // Only check first found config for this framework
      }
    }
  }

  return { issues, autoFixes };
}

/**
 * Framework-specific post-build validators.
 */
const FRAMEWORK_VALIDATORS: Record<string, (cwd: string) => { valid: boolean; error?: string } | null> = {
  // Next.js: requires .next/ directory with server files
  nextjs: (cwd) => {
    const nextDir = path.join(cwd, ".next");
    const hasNextDir = fs.existsSync(nextDir) && fs.statSync(nextDir).isDirectory();

    if (!hasNextDir) {
      return {
        valid: false,
        error: "Next.js build completed but '.next/' directory not found. " +
          "This may indicate 'output: \"export\"' mode which creates static HTML instead of a server build. " +
          "Remove 'output: \"export\"' from next.config to enable containerized deployment."
      };
    }

    return { valid: true };
  },

  // SvelteKit: requires .svelte-kit/output or build/
  sveltekit: (cwd) => {
    const outputDir = path.join(cwd, ".svelte-kit", "output");
    const buildDir = path.join(cwd, "build");
    const hasOutput = fs.existsSync(outputDir) || fs.existsSync(buildDir);

    if (!hasOutput) {
      return {
        valid: false,
        error: "SvelteKit build did not produce expected output. " +
          "Ensure you have a Node.js compatible adapter configured."
      };
    }

    return { valid: true };
  },

  // Nuxt: requires .output/ directory
  nuxt: (cwd) => {
    const outputDir = path.join(cwd, ".output");
    const hasOutput = fs.existsSync(outputDir) && fs.statSync(outputDir).isDirectory();

    if (!hasOutput) {
      return {
        valid: false,
        error: "Nuxt build did not produce '.output/' directory. " +
          "Ensure nitro preset is not set to 'static' for containerized deployment."
      };
    }

    return { valid: true };
  },

  // Vite: dist/ is expected but Vite is typically static - just warn
  vite: (cwd) => {
    const distDir = path.join(cwd, "dist");
    const hasDist = fs.existsSync(distDir) && fs.statSync(distDir).isDirectory();

    if (!hasDist) {
      return {
        valid: false,
        error: "Vite build did not produce 'dist/' directory. " +
          "Ensure your build script is configured correctly."
      };
    }

    // Check if this is a static Vite site (no server entry)
    // Vite with @vitejs/plugin-ssr or custom server would need different handling
    return { valid: true };
  },
};

/**
 * Post-build validation: Verify expected files exist in the built image.
 * Returns true if valid, false with error message if not.
 */
async function validateBuildOutput(
  deploymentId: string,
  cwd: string
): Promise<{ valid: boolean; error?: string }> {
  // Detect which framework is used
  const frameworks: Array<{ name: string; configFiles: string[] }> = [
    { name: "nextjs", configFiles: ["next.config.ts", "next.config.js", "next.config.mjs"] },
    { name: "sveltekit", configFiles: ["svelte.config.js", "svelte.config.ts"] },
    { name: "nuxt", configFiles: ["nuxt.config.ts", "nuxt.config.js"] },
    { name: "vite", configFiles: ["vite.config.ts", "vite.config.js", "vite.config.mjs"] },
  ];

  for (const { name, configFiles } of frameworks) {
    const hasFramework = configFiles.some(f => fs.existsSync(path.join(cwd, f)));
    if (hasFramework) {
      const validator = FRAMEWORK_VALIDATORS[name];
      if (validator) {
        const result = validator(cwd);
        if (result && !result.valid) {
          return result;
        }

        // Log warnings for missing non-critical files
        if (name === "nextjs") {
          const nextDir = path.join(cwd, ".next");
          const criticalFiles = ["BUILD_ID", "server", "static"];
          const missing = criticalFiles.filter(f => !fs.existsSync(path.join(nextDir, f)));
          if (missing.length > 0) {
            await appendLog(deploymentId, {
              stage: "build",
              level: "warn",
              message: `Next.js build missing expected files: ${missing.join(", ")}. Build may be incomplete.`,
            });
          }
        }
      }
      break; // Only validate first detected framework
    }
  }

  return { valid: true };
}

export async function runBuildStage(ctx: StageContext): Promise<BuildResult> {
  const { deployment } = ctx;
  const id = deployment.id;
  const imageTag = imageRefFor(id);
  let appliedFixes: Array<{ description: string; revert: () => void }> = [];

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

    // Pre-build validation: detect common misconfigurations
    const { issues, autoFixes } = detectConfigIssues(cwd);

    // Log issues
    for (const issue of issues) {
      await appendLog(id, {
        stage: "build",
        level: "warn",
        message: issue,
      });
    }

    // Apply auto-fixes
    if (autoFixes.length > 0) {
      for (const fix of autoFixes) {
        await appendLog(id, {
          stage: "build",
          level: "info",
          message: `🔧 ${fix.description}`,
        });
        fix.apply();
        appliedFixes.push({ description: fix.description, revert: fix.revert });
      }
    }

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

    // Post-build validation
    const validation = await validateBuildOutput(id, cwd);
    if (!validation.valid) {
      await appendLog(id, {
        stage: "build",
        level: "error",
        message: validation.error!,
      });
      return {
        success: false,
        imageTag: null,
        error: validation.error,
      };
    }

    return result;
  } finally {
    // Revert auto-fixes
    if (appliedFixes.length > 0) {
      for (const fix of appliedFixes) {
        try {
          fix.revert();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          void appendLog(id, {
            stage: "build",
            level: "warn",
            message: `Failed to revert auto-fix (${fix.description}): ${msg}`,
          });
        }
      }
    }

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
