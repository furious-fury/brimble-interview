import { promises as fsp } from "node:fs";
import path from "node:path";
import { Router, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { enqueueDeployment } from "../pipeline/queue.js";
import { cleanupDeploymentWorkspace } from "../pipeline/workspace/cleanup.js";
import { extractArchiveToSource, isAllowedArchive } from "../pipeline/workspace/extractArchive.js";
import { getDeploymentWorkspaceDir, getExtractedSourceDir, ensureDirSync } from "../pipeline/workspace/paths.js";
import { destroyDeploymentRuntime } from "../services/deploymentRuntime.js";
import {
  createDeployment,
  deleteDeployment,
  getDeploymentById,
  listDeployments,
  patchDeploymentFields,
} from "../services/deploymentService.js";
import { appendLog, listLogsAfterId, listRecentLogs } from "../services/logService.js";
import { subscribeToLogs, type LogEventPayload } from "../services/logBus.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { badRequestError, notFoundError } from "../middleware/errorHandler.js";
import { normalizeGitSourceForCreate } from "../lib/gitSourceNormalize.js";
import { createDeploymentBodySchema, listDeploymentsQuerySchema } from "../validation/deployments.js";

const LOG_REPLAY_MAX = 500;
const HEARTBEAT_MS = 20_000;
const UPLOAD_MAX_BYTES = 100 * 1024 * 1024;
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_BYTES },
});

const router = Router();

function sseEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

const idParam = z.string().cuid("Invalid id");

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = listDeploymentsQuerySchema.parse(req.query);
    const list = await listDeployments(q.limit);
    res.json({ data: list });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createDeploymentBodySchema.parse(req.body);
    const n = normalizeGitSourceForCreate({ source: body.source, ref: body.ref });
    const d = await createDeployment({
      name: body.name,
      sourceType: "git",
      source: n.source,
      sourceRef: n.ref,
    });
    await appendLog(d.id, {
      stage: "build",
      level: "info",
      message: "Deployment record created. Pipeline queued.",
    });
    enqueueDeployment(d.id);
    res.status(201).json({ data: d });
  })
);

function uploadFileExtension(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".tar.gz")) return ".tar.gz";
  if (lower.endsWith(".tgz")) return ".tgz";
  if (lower.endsWith(".zip")) return ".zip";
  return path.extname(filename) || ".bin";
}

router.post(
  "/upload",
  uploadMemory.single("file"),
  asyncHandler(async (req, res) => {
    const name = z.string().min(1).max(200).trim().parse((req.body as { name?: unknown }).name);
    const file = req.file;
    if (!file) {
      throw badRequestError('Multipart field "file" is required');
    }
    if (!isAllowedArchive(file.originalname)) {
      throw badRequestError("Only .zip or .tar.gz / .tgz archives are allowed");
    }
    const d = await createDeployment({
      name,
      sourceType: "upload",
      source: "pending",
    });
    const base = getDeploymentWorkspaceDir(d.id);
    const uploadPath = path.join(base, "upload" + uploadFileExtension(file.originalname));
    try {
      ensureDirSync(base);
      await fsp.writeFile(uploadPath, file.buffer);
      await extractArchiveToSource(uploadPath, file.originalname, d.id);
      await fsp.rm(uploadPath, { force: true });
      const sourcePath = getExtractedSourceDir(d.id);
      await patchDeploymentFields(d.id, { source: sourcePath });
      const updated = await getDeploymentById(d.id);
      if (!updated) {
        throw new Error("Deployment record missing after upload");
      }
      await appendLog(d.id, {
        stage: "build",
        level: "info",
        message: "Upload extracted. Pipeline queued.",
      });
      enqueueDeployment(d.id);
      res.status(201).json({ data: updated });
    } catch (e) {
      await deleteDeployment(d.id).catch(() => {});
      await cleanupDeploymentWorkspace(d.id).catch(() => {});
      throw e;
    }
  })
);

const logsQuerySchema = z.object({
  afterId: z.string().cuid().optional(),
});

router.get(
  "/:id/logs",
  asyncHandler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const q = logsQuerySchema.parse(req.query);
    const exists = await getDeploymentById(id);
    if (!exists) {
      throw notFoundError("Deployment not found");
    }
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    if (req.socket) {
      req.socket.setTimeout(0);
    }
    res.flushHeaders();

    let replay: Awaited<ReturnType<typeof listRecentLogs>>;
    if (q.afterId) {
      const after = await listLogsAfterId(id, q.afterId, LOG_REPLAY_MAX);
      if (after === null) {
        throw badRequestError("Log cursor (afterId) not found for this deployment");
      }
      replay = after;
    } else {
      replay = await listRecentLogs(id, LOG_REPLAY_MAX);
    }
    for (const line of replay) {
      sseEvent(res, "log", line);
    }
    sseEvent(res, "replay_done", { count: replay.length, incremental: Boolean(q.afterId) });

    const unsubscribe = subscribeToLogs(id, (payload: LogEventPayload) => {
      try {
        sseEvent(res, "log", payload);
      } catch {
        // client gone
      }
    });

    const heart = setInterval(() => {
      try {
        res.write(`:ping ${Date.now()}\n\n`);
      } catch {
        // ignore
      }
    }, HEARTBEAT_MS);

    const cleanup = () => {
      clearInterval(heart);
      unsubscribe();
    };
    res.on("close", cleanup);
    res.on("finish", cleanup);
    req.on("close", cleanup);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const d = await getDeploymentById(id);
    if (!d) {
      throw notFoundError("Deployment not found");
    }
    res.json({ data: d });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const ex = await getDeploymentById(id);
    if (!ex) {
      throw notFoundError("Deployment not found");
    }
    await destroyDeploymentRuntime(id);
    const ok = await deleteDeployment(id);
    if (!ok) {
      throw notFoundError("Deployment not found");
    }
    res.status(204).end();
  })
);

export { router as deploymentsRouter };
