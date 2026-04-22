import type { LogLevel, LogStage } from "../generated/prisma/client.js";
import { prisma } from "../db/prisma.js";
import { emitLogEvent, type LogEventPayload } from "./logBus.js";
import type { LogEntry } from "../types/logEntry.js";

export type { LogEntry, LogLevelName, LogStageName } from "../types/logEntry.js";

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
    stage: row.stage as LogEntry["stage"],
    level: row.level as LogEntry["level"],
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

/** Last N log lines, oldest first (for SSE full replay) */
export async function listRecentLogs(deploymentId: string, take: number): Promise<LogEventPayload[]> {
  const rows = await prisma.log.findMany({
    where: { deploymentId },
    orderBy: { timestamp: "desc" },
    take,
  });
  return rows.reverse().map(toPayload);
}

/**
 * Log lines **after** a cursor row (by id), oldest first, up to `take` rows.
 * Returns `null` if `afterId` does not exist for this deployment.
 */
export async function listLogsAfterId(
  deploymentId: string,
  afterId: string,
  take: number
): Promise<LogEventPayload[] | null> {
  const cursor = await prisma.log.findFirst({
    where: { id: afterId, deploymentId },
  });
  if (!cursor) {
    return null;
  }
  const rows = await prisma.log.findMany({
    where: {
      deploymentId,
      OR: [
        { timestamp: { gt: cursor.timestamp } },
        { AND: [{ timestamp: cursor.timestamp }, { id: { gt: afterId } }] },
      ],
    },
    orderBy: [{ timestamp: "asc" }, { id: "asc" }],
    take,
  });
  return rows.map(toPayload);
}

