import "dotenv/config";
import cors from "cors";
import express from "express";
import { startContainerHealthLoop } from "./services/containerHealth.js";
import { pingDocker } from "./services/dockerClient.js";
import { initPortRegistryFromDocker } from "./services/portAllocator.js";
import { caddyRouter } from "./routes/caddy.js";
import { deploymentsRouter } from "./routes/deployments.js";
import { healthRouter } from "./routes/health.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";
const corsOrigin = process.env.CORS_ORIGIN;

app.use(
  cors({
    origin: corsOrigin ? corsOrigin.split(",").map((o) => o.trim()) : true,
  })
);
app.use(express.json({ limit: "2mb" }));

app.use("/api", healthRouter);
app.use("/api", caddyRouter);
app.use("/api/deployments", deploymentsRouter);

app.get("/", (_req, res) => {
  res.json({ service: "brimble-api", version: "0.1.0" });
});

app.use(errorHandler);

void (async () => {
  try {
    await pingDocker();
  } catch (e) {
    console.warn("[brimble-api] Docker ping failed — deploy will not work until the socket is reachable:", e);
  }
  try {
    await initPortRegistryFromDocker();
  } catch (e) {
    console.warn("[brimble-api] Port registry init failed:", e);
  }
  startContainerHealthLoop();
  app.listen(port, host, () => {
    console.log(`[brimble-api] http://${host}:${port}`);
  });
})();
