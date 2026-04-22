/**
 * Log line on the **wire** (JSON / SSE) — same shape the API and {@link ../services/logBus#LogEventPayload} use.
 * Matches IMPLEMENTATION_PLAN `LogEntry` except `timestamp` is ISO 8601 (persistence uses `Date` in SQLite).
 */
export type LogStageName = "build" | "deploy" | "runtime";
export type LogLevelName = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  id: string;
  deploymentId: string;
  stage: LogStageName;
  level: LogLevelName;
  message: string;
  /** ISO 8601 */
  timestamp: string;
}
