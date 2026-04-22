import { beforeEach } from "vitest";
import { resetTestDatabase } from "./resetTestDb.js";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./prisma/test.db";
}

beforeEach(async () => {
  await resetTestDatabase();
});
