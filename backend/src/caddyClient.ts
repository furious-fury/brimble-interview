import { mkdir, unlink, writeFile, utimes } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const applyBody = z.object({
  /** e.g. myapp.localhost (no port) */
  host: z.string().min(1).max(253),
  /** e.g. http://172.20.0.5:10001 */
  upstream: z.string().url(),
  /** file-safe id for the snippet; defaults from host */
  id: z.string().min(1).max(120).optional(),
});

export type CaddyRouteRegistration = z.infer<typeof applyBody>;

const caddyAdmin = process.env.CADDY_ADMIN_URL || "http://127.0.0.1:2019";
const dynamicDir = process.env.CADDY_DYNAMIC_DIR;

export function getMainCaddyfilePath(): string {
  return process.env.CADDYFILE_PATH || "/etc/caddy/Caddyfile";
}

export async function pingCaddyAdmin(): Promise<{
  ok: boolean;
  status?: number;
  error?: string;
}> {
  try {
    const r = await fetch(caddyAdmin, { method: "GET" });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Writes a Caddyfile snippet and touches the main Caddyfile so a watch-based
 * reload (see docker-compose) picks up new deployment routes.
 * Snippet format: one site block per file.
 */
export async function writeDeploymentRouteSnippet(
  reg: CaddyRouteRegistration
): Promise<{ file: string; note: string }> {
  if (!dynamicDir) {
    return {
      file: "",
      note: "CADDY_DYNAMIC_DIR not set; route stored in memory only",
    };
  }
  const id = reg.id ?? reg.host.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const fileName = path.join(dynamicDir, `${id}.caddy`);
  const block = `${reg.host} {\n\treverse_proxy ${reg.upstream}\n}\n`;
  await mkdir(path.dirname(fileName), { recursive: true });
  await writeFile(fileName, block, "utf8");
  return { file: fileName, note: "Snippet written" };
}

/** Touch a file to trigger caddy --watch (path from env) */
export async function touchCaddyfile(pathToCaddyfile: string): Promise<void> {
  const now = new Date();
  await utimes(pathToCaddyfile, now, now);
}

/**
 * Writes the snippet and touches the main Caddyfile so Caddy reloads (unless `SKIP_CADDY_RELOAD=1`).
 */
export async function registerDeploymentRouteWithReload(
  reg: CaddyRouteRegistration
): Promise<{ file: string; note: string }> {
  const w = await writeDeploymentRouteSnippet(reg);
  if (w.file) {
    try {
      if (process.env.SKIP_CADDY_RELOAD === "1") {
        // tests / local without Caddy
      } else {
        await touchCaddyfile(getMainCaddyfilePath());
      }
    } catch (e) {
      console.warn("Could not touch Caddyfile; route may not reload until manual reload", e);
    }
  }
  return w;
}

/**
 * Removes `CADDY_DYNAMIC_DIR/<deploymentId>.caddy` and touches the main Caddyfile. Safe on ENOENT.
 */
export async function removeDeploymentRouteForId(deploymentId: string): Promise<{
  ok: boolean;
  note: string;
}> {
  if (!dynamicDir) {
    return { ok: true, note: "CADDY_DYNAMIC_DIR not set" };
  }
  const fileName = path.join(dynamicDir, `${deploymentId}.caddy`);
  try {
    await unlink(fileName);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err?.code === "ENOENT") {
      return { ok: true, note: "Snippet already absent" };
    }
    return { ok: false, note: err?.message ?? String(e) };
  }
  try {
    if (process.env.SKIP_CADDY_RELOAD !== "1") {
      await touchCaddyfile(getMainCaddyfilePath());
    }
  } catch (e) {
    console.warn("Could not touch Caddyfile after route removal", e);
  }
  return { ok: true, note: "Removed" };
}

export { applyBody, caddyAdmin, dynamicDir };
