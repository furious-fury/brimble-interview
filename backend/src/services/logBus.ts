import { EventEmitter } from "node:events";
import type { LogEntry } from "../types/logEntry.js";

/** In-memory broadcast payload; same as {@link LogEntry} for every persisted line. */
export type LogEventPayload = LogEntry;

/** Special control event to notify clients that logs were cleared (e.g., on redeploy). */
export type LogControlEvent = { type: "logs_cleared" };

const bus = new EventEmitter();
bus.setMaxListeners(0);

export function logChannelName(deploymentId: string): string {
  return `log:${deploymentId}`;
}

export function emitLogEvent(deploymentId: string, payload: LogEventPayload): void {
  bus.emit(logChannelName(deploymentId), payload);
}

/**
 * Emit a control event (non-log) to all subscribers.
 * Used for out-of-band notifications like logs being cleared.
 */
export function emitLogControlEvent(deploymentId: string, event: LogControlEvent): void {
  bus.emit(logChannelName(deploymentId), event);
}

export function subscribeToLogs(
  deploymentId: string,
  handler: (payload: LogEventPayload | LogControlEvent) => void
): () => void {
  const ch = logChannelName(deploymentId);
  bus.on(ch, handler);
  return () => {
    bus.off(ch, handler);
  };
}
