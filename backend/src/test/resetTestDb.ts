import { prisma } from "../db/prisma.js";

export async function resetTestDatabase(): Promise<void> {
  await prisma.log.deleteMany();
  await prisma.deployment.deleteMany();
}
