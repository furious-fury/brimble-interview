import "dotenv/config";
import { buildApp } from "./app.js";
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
    console.warn(
      "[brimble-api] Docker ping failed — deploy will not work until the socket is reachable:",
      e
    );
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
