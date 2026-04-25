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
  logger.info({ file: fileName, host: reg.host, upstream: reg.upstream, content: block.trim() }, "Caddy route snippet written");
  return { file: fileName, note: "Snippet written" };
}

/** Touch a file to trigger caddy --watch (path from env) */
export async function touchCaddyfile(pathToCaddyfile: string): Promise<void> {
  const now = new Date();
  await utimes(pathToCaddyfile, now, now);
}

/**
 * Explicitly reload Caddy configuration via the Admin API.
 * More reliable than --watch file watching, especially in Docker.
 */
export async function reloadCaddy(): Promise<{ ok: boolean; error?: string }> {
  try {
    const caddyfilePath = getMainCaddyfilePath();
    const fs = await import("node:fs/promises");

    logger.info({ caddyfilePath, dynamicDir, caddyAdmin }, "Starting Caddy reload");

    // Read the main Caddyfile
    let caddyfileContent = await fs.readFile(caddyfilePath, "utf8");
    logger.debug({ mainCaddyfileLength: caddyfileContent.length }, "Read main Caddyfile");

    // Remove the import statement since we'll inline the dynamic routes directly
    caddyfileContent = caddyfileContent.replace(/import\s+["']?\/etc\/caddy\/dynamic\/\*\.caddy["']?\s*\n?/g, "");
    logger.debug("Removed import statement from Caddyfile content for inlining");

    // Collect dynamic routes - these must come BEFORE the catch-all :80 block
    let dynamicRoutes = "";
    if (dynamicDir) {
      try {
        const dynamicFiles = await fs.readdir(dynamicDir);
        const caddyFiles = dynamicFiles.filter(f => f.endsWith('.caddy'));

        logger.info({ dynamicDir, caddyFileCount: caddyFiles.length, caddyFiles }, "Found dynamic Caddy files");

        for (const file of caddyFiles) {
          const filePath = path.join(dynamicDir, file);
          const content = await fs.readFile(filePath, "utf8");
          dynamicRoutes += content + "\n";
          logger.debug({ file, content: content.trim() }, "Inlined dynamic Caddy route");
        }
      } catch (err) {
        logger.warn({ err, dynamicDir }, "Could not read dynamic Caddy files");
      }
    }

    // Insert dynamic routes BEFORE the catch-all :80 block
    // Find the catch-all block and insert dynamic routes before it
    const catchAllMatch = caddyfileContent.match(/\n?:80\s*\{/);
    if (catchAllMatch && dynamicRoutes) {
      const insertIndex = catchAllMatch.index;
      caddyfileContent = caddyfileContent.slice(0, insertIndex) + "\n" + dynamicRoutes + caddyfileContent.slice(insertIndex);
      logger.debug({ insertIndex, dynamicRoutesLength: dynamicRoutes.length }, "Inserted dynamic routes before catch-all block");
    } else if (dynamicRoutes) {
      // Fallback: append if no catch-all found
      caddyfileContent += "\n" + dynamicRoutes;
      logger.debug("Appended dynamic routes (no catch-all block found)");
    }

    logger.debug({ totalConfigLength: caddyfileContent.length }, "Sending config to Caddy admin API");

    // Load and adapt Caddyfile to JSON
    const loadRes = await fetch(`${caddyAdmin}/load`, {
      method: "POST",
      headers: { "Content-Type": "text/caddyfile" },
      body: caddyfileContent,
    });

    if (!loadRes.ok) {
      const errorText = await loadRes.text();
      logger.error({ status: loadRes.status, error: errorText }, "Caddy admin API load failed");
      return { ok: false, error: `Caddy load failed: ${loadRes.status} ${errorText}` };
    }

    logger.info("Caddy configuration reloaded successfully via Admin API");
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    logger.error({ err: e }, "Failed to reload Caddy via Admin API");
    return { ok: false, error };
  }
}

/**
 * Writes the snippet and reloads Caddy configuration (unless `SKIP_CADDY_RELOAD=1`).
 * Uses Admin API for immediate reload, falling back to file touch for --watch mode.
 */
export async function registerDeploymentRouteWithReload(
  reg: CaddyRouteRegistration
): Promise<{ file: string; note: string }> {
  const w = await writeDeploymentRouteSnippet(reg);
  if (w.file) {
    try {
      if (process.env.SKIP_CADDY_RELOAD === "1") {
        logger.info("Skipping Caddy reload (SKIP_CADDY_RELOAD=1)");
      } else {
        // Try explicit API reload first (more reliable)
        logger.info({ file: w.file }, "Reloading Caddy configuration...");
        const reloadResult = await reloadCaddy();
        if (!reloadResult.ok) {
          // Fallback to touching file for --watch mode
          logger.warn("API reload failed, falling back to file touch: " + reloadResult.error);
          await touchCaddyfile(getMainCaddyfilePath());
        } else {
          logger.info("Caddy configuration reloaded successfully via Admin API");
        }
      }
    } catch (e) {
      logger.warn({ err: e }, "Could not reload Caddy configuration");
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
        // Try explicit API reload first (more reliable)
        const reloadResult = await reloadCaddy();
        if (!reloadResult.ok) {
          // Fallback to touching file for --watch mode
          logger.debug("API reload failed, falling back to file touch: " + reloadResult.error);
          await touchCaddyfile(getMainCaddyfilePath());
        }
      }
    } catch (e) {
      logger.warn({ err: e }, "Could not reload Caddy after route removal");
    }
  }
  return { ok: true, note: "Removed" };
}

export { applyBody, caddyAdmin, dynamicDir };
