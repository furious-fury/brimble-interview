import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dir = path.dirname(fileURLToPath(import.meta.url));
const testDb = "file:./prisma/test.db";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    globalSetup: path.join(dir, "src/test/globalSetup.ts"),
    setupFiles: [path.join(dir, "src/test/setup.ts")],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDb,
    },
  },
});
