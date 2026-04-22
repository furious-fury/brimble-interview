import { Router } from "express";
import {
  applyBody,
  dynamicDir,
  pingCaddyAdmin,
  touchCaddyfile,
  writeDeploymentRouteSnippet,
} from "../caddyClient.js";

const mainCaddyfile = process.env.CADDYFILE_PATH || "/etc/caddy/Caddyfile";

const memory: Array<{
  host: string;
  upstream: string;
  at: string;
  file?: string;
}> = [];

export const caddyRouter = Router();

caddyRouter.get("/caddy/status", async (_req, res) => {
  const admin = await pingCaddyAdmin();
  res.json({
    caddyAdminUrl: process.env.CADDY_ADMIN_URL ?? "http://127.0.0.1:2019",
    admin,
    dynamicDir: dynamicDir ?? null,
    registered: memory,
  });
});

caddyRouter.post("/caddy/routes", async (req, res) => {
  const parsed = applyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation", details: parsed.error.flatten() });
    return;
  }
  const reg = parsed.data;
  const w = await writeDeploymentRouteSnippet(reg);
  if (w.file) {
    try {
      if (process.env.SKIP_CADDY_RELOAD === "1") {
        // tests / dev without file touch
      } else {
        await touchCaddyfile(mainCaddyfile);
      }
    } catch (e) {
      console.warn("Could not touch Caddyfile; snippet may not reload until manual reload", e);
    }
  }
  const entry = {
    host: reg.host,
    upstream: reg.upstream,
    at: new Date().toISOString(),
    file: w.file || undefined,
  };
  memory.push(entry);
  res.json({ ok: true, ...entry, note: w.note });
});
