import fs from "node:fs";
import path from "node:path";

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
  // Next.js: output: 'export' → static HTML
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
export function detectConfigIssues(cwd: string): ConfigCheckResult {
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
