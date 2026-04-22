import type { DeploymentStatus, Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db/prisma.js";

const deploymentSelect = {
  id: true,
  name: true,
  sourceType: true,
  source: true,
  status: true,
  imageTag: true,
  containerId: true,
  url: true,
  port: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DeploymentSelect;

export type DeploymentDTO = {
  id: string;
  name: string;
  sourceType: string;
  source: string;
  status: string;
  imageTag: string | null;
  containerId: string | null;
  url: string | null;
  port: number | null;
  createdAt: string;
  updatedAt: string;
};

function toDTO(row: {
  id: string;
  name: string;
  sourceType: string;
  source: string;
  status: string;
  imageTag: string | null;
  containerId: string | null;
  url: string | null;
  port: number | null;
  createdAt: Date;
  updatedAt: Date;
}): DeploymentDTO {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createDeployment(input: {
  name: string;
  sourceType: "git" | "upload";
  source: string;
}): Promise<DeploymentDTO> {
  const row = await prisma.deployment.create({
    data: {
      name: input.name,
      sourceType: input.sourceType,
      source: input.source,
      status: "pending",
    },
    select: deploymentSelect,
  });
  return toDTO(row);
}

export async function listDeployments(limit: number): Promise<DeploymentDTO[]> {
  const rows = await prisma.deployment.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: deploymentSelect,
  });
  return rows.map(toDTO);
}

export async function getDeploymentById(id: string): Promise<DeploymentDTO | null> {
  const row = await prisma.deployment.findUnique({
    where: { id },
    select: deploymentSelect,
  });
  return row ? toDTO(row) : null;
}

export async function deleteDeployment(id: string): Promise<boolean> {
  try {
    await prisma.deployment.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function updateDeploymentStatus(
  id: string,
  status: DeploymentStatus
): Promise<DeploymentDTO | null> {
  try {
    const row = await prisma.deployment.update({
      where: { id },
      data: { status },
      select: deploymentSelect,
    });
    return toDTO(row);
  } catch {
    return null;
  }
}
