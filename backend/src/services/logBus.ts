import { EventEmitter } from "node:events";

export type LogEventPayload = {
  id: string;
  deploymentId: string;
  stage: string;
  level: string;
  message: string;
  timestamp: string;
};

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
