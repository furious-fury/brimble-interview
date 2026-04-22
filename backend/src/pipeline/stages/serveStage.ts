import type { DeployResult, RunResult, StageContext } from "./resultTypes.js";

/**
 * Public URL to open the app in a browser on the **host** machine.
 * Phase 7 will replace with Caddy. Override base with `BRIMBLE_APP_PUBLIC_BASE` (e.g. `http://127.0.0.1`, no path).
 */
export async function runServeStage(_ctx: StageContext, deploy: DeployResult): Promise<RunResult> {
  const base = (process.env.BRIMBLE_APP_PUBLIC_BASE ?? "http://localhost").replace(/\/$/, "");
  return { url: `${base}:${deploy.port}` };
}
