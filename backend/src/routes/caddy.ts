import { Router } from "express";
import {
  applyBody,
  dynamicDir,
  pingCaddyAdmin,
  registerDeploymentRouteWithReload,
} from "../caddyClient.js";

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
  const w = await registerDeploymentRouteWithReload(reg);
  const entry = {
    host: reg.host,
    upstream: reg.upstream,
    at: new Date().toISOString(),
    file: w.file || undefined,
  };
  memory.push(entry);
  res.json({ ok: true, ...entry, note: w.note });
});
