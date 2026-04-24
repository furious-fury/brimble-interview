import { promises as fsp } from "node:fs";
import path from "node:path";
import { Router, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { API_CONSTANTS } from "../config/constants.js";
import { logger } from "../config/logger.js";
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
  resetDeploymentForRedeploy,
} from "../services/deploymentService.js";
import { appendLog, clearLogs, listLogsAfterId, listRecentLogs } from "../services/logService.js";
import { emitLogControlEvent } from "../services/logBus.js";
import { subscribeToLogs, type LogEventPayload, type LogControlEvent } from "../services/logBus.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { badRequestError, notFoundError } from "../middleware/errorHandler.js";
import { normalizeGitSourceForCreate } from "../lib/gitSourceNormalize.js";
import { createDeploymentBodySchema, listDeploymentsQuerySchema, redeployBodySchema } from "../validation/deployments.js";

const { LOG_REPLAY_MAX, HEARTBEAT_MS, UPLOAD_MAX_BYTES } = API_CONSTANTS;
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
      envVars: body.envVars,
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
    const envVarsJson = (req.body as { envVars?: unknown }).envVars;
    let envVars: Record<string, string> | undefined;
    if (typeof envVarsJson === "string" && envVarsJson.trim()) {
      try {
        envVars = JSON.parse(envVarsJson) as Record<string, string>;
      } catch {
        throw badRequestError("Invalid envVars JSON");
      }
    }
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
      envVars,
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
      await deleteDeployment(d.id).catch((err) => {
        logger.warn({ deploymentId: d.id, err }, "Failed to delete deployment during cleanup");
      });
      await cleanupDeploymentWorkspace(d.id).catch((err) => {
        logger.warn({ deploymentId: d.id, err }, "Failed to cleanup workspace");
      });
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

    const unsubscribe = subscribeToLogs(id, (payload: LogEventPayload | LogControlEvent) => {
      try {
        // Handle control events (e.g., logs_cleared on redeploy)
        if ("type" in payload && payload.type === "logs_cleared") {
          sseEvent(res, "logs_cleared", {});
        } else {
          sseEvent(res, "log", payload as LogEventPayload);
        }
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

/** Redeploy: destroy runtime, clear logs, reset to pending, requeue */
router.post(
  "/:id/redeploy",
  asyncHandler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const body = redeployBodySchema.parse(req.body);
    const ex = await getDeploymentById(id);
    if (!ex) {
      throw notFoundError("Deployment not found");
    }

    // Destroy existing runtime if any
    await destroyDeploymentRuntime(id);

    // Clear all logs for fresh start
    await clearLogs(id);
    // Notify any connected SSE clients to clear their logs
    emitLogControlEvent(id, { type: "logs_cleared" });

    // Reset deployment to pending state
    const reset = await resetDeploymentForRedeploy(id);
    if (!reset) {
      throw notFoundError("Failed to reset deployment");
    }

    // Optionally update envVars if provided
    if (body.envVars !== undefined) {
      await patchDeploymentFields(id, {
        envVars: body.envVars ? JSON.stringify(body.envVars) : null,
      });
    }

    // Log and requeue
    await appendLog(id, {
      stage: "build",
      level: "info",
      message: "Redeployment started. Pipeline queued.",
    });
    enqueueDeployment(id);

    const updated = await getDeploymentById(id);
    res.status(200).json({ data: updated });
  })
);

export { router as deploymentsRouter };
