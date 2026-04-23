import cors from "cors";
import express from "express";
import { caddyRouter } from "./routes/caddy.js";
import { deploymentsRouter } from "./routes/deployments.js";
import { healthRouter } from "./routes/health.js";
import { reposRouter } from "./routes/repos.js";
import { errorHandler } from "./middleware/errorHandler.js";

/**
 * Express app without listen() or process startup (Docker, health loop).
 * Used by the HTTP server and by tests.
 */
export function buildApp(): express.Express {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN;

  app.use(
    cors({
      origin: corsOrigin ? corsOrigin.split(",").map((o) => o.trim()) : true,
    })
  );
  app.use(express.json({ limit: "2mb" }));

  app.use("/api", healthRouter);
  app.use("/api", caddyRouter);
  app.use("/api/repos", reposRouter);
  app.use("/api/deployments", deploymentsRouter);

  app.get("/", (_req, res) => {
    res.json({ service: "brimble-api", version: "0.1.0" });
  });

  app.use(errorHandler);
  return app;
}
