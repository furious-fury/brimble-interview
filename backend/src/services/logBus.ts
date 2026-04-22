import { EventEmitter } from "node:events";
import type { LogEntry } from "../types/logEntry.js";

/** In-memory broadcast payload; same as {@link LogEntry} for every persisted line. */
export type LogEventPayload = LogEntry;

const bus = new EventEmitter();
bus.setMaxListeners(0);

export function logChannelName(deploymentId: string): string {
  return `log:${deploymentId}`;
}

export function emitLogEvent(deploymentId: string, payload: LogEventPayload): void {
  bus.emit(logChannelName(deploymentId), payload);
}

export function subscribeToLogs(
  deploymentId: string,
  handler: (payload: LogEventPayload) => void
): () => void {
  const ch = logChannelName(deploymentId);
  bus.on(ch, handler);
  return () => {
    bus.off(ch, handler);
  };
}
