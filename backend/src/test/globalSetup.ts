import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

const databaseUrl = "file:./prisma/test.db";

/**
 * One-time: apply migrations to the test SQLite file before the test run.
 */
export default function globalSetup(): void {
  execSync("npx prisma migrate deploy", {
    cwd: backendRoot,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
