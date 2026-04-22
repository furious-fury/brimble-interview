import { Router, type Response } from "express";
import { z } from "zod";
import { enqueueDeployment } from "../pipeline/queue.js";
import {
  createDeployment,
  deleteDeployment,
  getDeploymentById,
  listDeployments,
} from "../services/deploymentService.js";
import { appendLog, listRecentLogs } from "../services/logService.js";
import { subscribeToLogs, type LogEventPayload } from "../services/logBus.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { notFoundError } from "../middleware/errorHandler.js";
import { createDeploymentBodySchema, listDeploymentsQuerySchema } from "../validation/deployments.js";

const LOG_REPLAY_MAX = 500;
const HEARTBEAT_MS = 20_000;

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
    const d = await createDeployment(body);
    await appendLog(d.id, {
      stage: "build",
      level: "info",
      message: "Deployment record created. Pipeline queued.",
    });
    enqueueDeployment(d.id);
    res.status(201).json({ data: d });
  })
);

router.get(
  "/:id/logs",
  asyncHandler(async (req, res) => {
    const id = idParam.parse(req.params.id);
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

    const replay = await listRecentLogs(id, LOG_REPLAY_MAX);
    for (const line of replay) {
      sseEvent(res, "log", line);
    }
    sseEvent(res, "replay_done", { count: replay.length });

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
    const ok = await deleteDeployment(id);
    if (!ok) {
      throw notFoundError("Deployment not found");
    }
    res.status(204).end();
  })
);

export { router as deploymentsRouter };
