import fs from "node:fs";
import path from "node:path";
import { PIPELINE_CONSTANTS } from "../config/constants.js";
import { appendLog } from "../services/logService.js";

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

    return { valid: true };
  },
};

/**
 * Post-build validation: Verify expected files exist in the built image.
 * Returns true if valid, false with error message if not.
 */
export async function validateBuildOutput(
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
          const criticalFiles = PIPELINE_CONSTANTS.NEXTJS_CRITICAL_FILES;
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
