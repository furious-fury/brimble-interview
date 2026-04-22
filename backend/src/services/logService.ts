import type { LogLevel, LogStage } from "../generated/prisma/client.js";
import { prisma } from "../db/prisma.js";
import { emitLogEvent, type LogEventPayload } from "./logBus.js";

function toPayload(row: {
  id: string;
  deploymentId: string;
  stage: LogStage;
  level: LogLevel;
  message: string;
  timestamp: Date;
}): LogEventPayload {
  return {
    id: row.id,
    deploymentId: row.deploymentId,
    stage: row.stage,
    level: row.level,
    message: row.message,
    timestamp: row.timestamp.toISOString(),
  };
}

export async function appendLog(
  deploymentId: string,
  data: { stage: LogStage; level: LogLevel; message: string; timestamp?: Date }
): Promise<LogEventPayload> {
  const row = await prisma.log.create({
    data: {
      deploymentId,
      stage: data.stage,
      level: data.level,
      message: data.message,
      ...(data.timestamp ? { timestamp: data.timestamp } : {}),
    },
  });
  const payload = toPayload(row);
  emitLogEvent(deploymentId, payload);
  return payload;
}

/** Last N log lines, oldest first (for SSE replay) */
export async function listRecentLogs(deploymentId: string, take: number): Promise<LogEventPayload[]> {
  const rows = await prisma.log.findMany({
    where: { deploymentId },
    orderBy: { timestamp: "desc" },
    take,
  });
  return rows.reverse().map(toPayload);
}

