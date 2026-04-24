import "dotenv/config";
import { buildApp } from "./app.js";
import { logger } from "./config/logger.js";
import { startContainerHealthLoop } from "./services/containerHealth.js";
import { pingDocker } from "./services/dockerClient.js";
import { initPortRegistryFromDocker } from "./services/portAllocator.js";

const app = buildApp();
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

void (async () => {
  try {
    await pingDocker();
  } catch (e) {
    logger.warn(
      { err: e },
      "Docker ping failed — deploy will not work until the socket is reachable"
    );
  }
  try {
    await initPortRegistryFromDocker();
  } catch (e) {
    logger.warn({ err: e }, "Port registry init failed");
  }
  startContainerHealthLoop();
  app.listen(port, host, () => {
    logger.info(`Server listening on http://${host}:${port}`);
  });
})();
