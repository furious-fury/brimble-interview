import type { DeploymentStatus, Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db/prisma.js";

const deploymentSelect = {
  id: true,
  name: true,
  sourceType: true,
  source: true,
  sourceRef: true,
  commitId: true,
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
  sourceRef: string | null;
  commitId: string | null;
  status: string;
  imageTag: string | null;
  containerId: string | null;
  url: string | null;
  port: number | null;
  envVars: string | null;
  createdAt: string;
  updatedAt: string;
};

function toDTO(row: {
  id: string;
  name: string;
  sourceType: string;
  source: string;
  sourceRef: string | null;
  commitId: string | null;
  status: string;
  imageTag: string | null;
  containerId: string | null;
  url: string | null;
  port: number | null;
  envVars?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DeploymentDTO {
  return {
    ...row,
    envVars: row.envVars ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createDeployment(input: {
  name: string;
  sourceType: "git" | "upload";
  source: string;
  sourceRef?: string | null;
  envVars?: Record<string, string> | null;
}): Promise<DeploymentDTO> {
  const row = await prisma.deployment.create({
    data: {
      name: input.name,
      sourceType: input.sourceType,
      source: input.source,
      sourceRef: input.sourceRef ?? null,
      envVars: input.envVars ? JSON.stringify(input.envVars) : null,
      status: "pending",
    },
    select: deploymentSelect,
  });
  return toDTO(row as Parameters<typeof toDTO>[0]);
}

export async function listDeployments(limit: number): Promise<DeploymentDTO[]> {
  const rows = await prisma.deployment.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: deploymentSelect,
  });
  return rows.map((r) => toDTO(r as Parameters<typeof toDTO>[0]));
}

export async function getDeploymentById(id: string): Promise<DeploymentDTO | null> {
  const row = await prisma.deployment.findUnique({
    where: { id },
    select: deploymentSelect,
  });
  return row ? toDTO(row as Parameters<typeof toDTO>[0]) : null;
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
    return toDTO(row as Parameters<typeof toDTO>[0]);
  } catch {
    return null;
  }
}

/** Reset deployment for redeploy: clear runtime fields, reset to pending */
export async function resetDeploymentForRedeploy(
  id: string
): Promise<DeploymentDTO | null> {
  try {
    const row = await prisma.deployment.update({
      where: { id },
      data: {
        status: "pending",
        imageTag: null,
        containerId: null,
        url: null,
        port: null,
      },
      select: deploymentSelect,
    });
    return toDTO(row as Parameters<typeof toDTO>[0]);
  } catch {
    return null;
  }
}

type RunFields = {
  source?: string;
  sourceRef?: string | null;
  imageTag?: string | null;
  containerId?: string | null;
  url?: string | null;
  port?: number | null;
  envVars?: string | null;
  status?: DeploymentStatus;
};

/** Patch run metadata and/or status (used by pipeline; status transitions should go through assertCanTransition in pipeline) */
export async function patchDeploymentFields(
  id: string,
  data: RunFields
): Promise<DeploymentDTO | null> {
  try {
    const row = await prisma.deployment.update({
      where: { id },
      data,
      select: deploymentSelect,
    });
    return toDTO(row as Parameters<typeof toDTO>[0]);
  } catch {
    return null;
  }
}
