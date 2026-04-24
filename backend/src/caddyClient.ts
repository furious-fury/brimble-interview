import { mkdir, unlink, writeFile, utimes } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { logger } from "./config/logger.js";

const applyBody = z.object({
  /** e.g. myapp.localhost (no port) — also used for the on-disk name: `myapp.localhost.caddy` */
  host: z.string().min(1).max(253),
  /** e.g. http://172.20.0.5:10001 */
  upstream: z.string().url(),
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

/** `higher-abc12345.localhost` → same string with unsafe chars stripped (Caddy vhost = filename stem). */
export function caddyRouteSnippetFileBasename(vhost: string): string {
  return vhost.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
}

/**
 * Writes a Caddyfile snippet and touches the main Caddyfile so a watch-based
 * reload (see docker-compose) picks up new deployment routes.
 * Snippet format: one site block per file, named from the vhost (e.g. `my-app-a1b2c3d4.localhost.caddy`).
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
  const fileName = path.join(dynamicDir, `${caddyRouteSnippetFileBasename(reg.host)}.caddy`);
  // Prefix `http://` so the site binds to :80. A bare `app.localhost { }` address is treated
  // as HTTPS-capable and can end up on :443 only, while browsers use http:// for these URLs.
  const block = `http://${reg.host} {\n\treverse_proxy ${reg.upstream}\n}\n`;
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
      logger.warn({ err: e }, "Could not touch Caddyfile to trigger reload");
    }
  }
  return w;
}

/**
 * Removes Caddy route snippets: `<vhost>.caddy` (when vhost is set) and legacy `<deploymentId>.caddy`.
 */
export async function removeDeploymentCaddyRoute(opts: {
  vhost?: string;
  /** Deployment id — removes older on-disk `cmobc3gzj0000….caddy` files from before vhost-based names. */
  legacyDeploymentId: string;
}): Promise<{
  ok: boolean;
  note: string;
}> {
  if (!dynamicDir) {
    return { ok: true, note: "CADDY_DYNAMIC_DIR not set" };
  }
  const files = new Set<string>();
  if (opts.vhost) {
    files.add(path.join(dynamicDir, `${caddyRouteSnippetFileBasename(opts.vhost)}.caddy`));
  }
  files.add(path.join(dynamicDir, `${opts.legacyDeploymentId}.caddy`));
  let lastErr: NodeJS.ErrnoException | undefined;
  let removed = 0;
  for (const fileName of files) {
    try {
      await unlink(fileName);
      removed++;
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err?.code !== "ENOENT") {
        lastErr = err;
      }
    }
  }
  if (lastErr) {
    return { ok: false, note: lastErr.message };
  }
  if (removed > 0) {
    try {
      if (process.env.SKIP_CADDY_RELOAD !== "1") {
        await touchCaddyfile(getMainCaddyfilePath());
      }
    } catch (e) {
      logger.warn({ err: e }, "Could not touch Caddyfile after route removal");
    }
  }
  return { ok: true, note: "Removed" };
}

export { applyBody, caddyAdmin, dynamicDir };
