import type { LogEntry, LogLevelName } from "../api/types.js";

function levelClass(level: LogLevelName): string {
  switch (level) {
    case "error":
      return "text-red-400 font-medium";
    case "warn":
      return "text-amber-400";
    case "debug":
      return "text-slate-500";
    case "info":
    default:
      return "text-slate-300";
  }
}

function stageClass(): string {
  return "text-slate-400";
}

function timeFmt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

interface LogEntryRowProps {
  entry: LogEntry;
}

/**
 * Single log entry row with timestamp, stage, level, and message.
 */
export function LogEntryRow({ entry }: LogEntryRowProps) {
  return (
    <div
      key={entry.id}
      className="flex flex-wrap gap-x-3 wrap-break-word border-b border-slate-600/50 py-1.5 pr-2 last:border-0"
    >
      <span className="shrink-0 text-slate-500 tabular-nums">
        {timeFmt(entry.timestamp)}
      </span>
      <span className={`shrink-0 ${stageClass()}`}>
        [{entry.stage}]
      </span>
      <span className={`shrink-0 ${levelClass(entry.level)}`}>
        {entry.level}
      </span>
      <span className="min-w-0 text-slate-300">{entry.message}</span>
    </div>
  );
}
