import "dotenv/config";
import { defineConfig } from "prisma/config";

// Default for prisma generate in CI / postinstall when .env is absent
const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
