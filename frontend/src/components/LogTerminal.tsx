import { useEffect, useRef } from "react";
import type { LogEntry } from "../api/types.js";
import { LogEntryRow } from "./LogEntryRow.js";

interface LogTerminalProps {
  logs: LogEntry[];
  deploymentId: string;
}

/**
 * Scrollable terminal-like log display with auto-scroll.
 */
export function LogTerminal({ logs, deploymentId }: LogTerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length, deploymentId]);

  return (
    <div
      className="max-h-[min(70vh,600px)] overflow-auto rounded-sm border border-slate-600 bg-slate-700 p-4 font-mono text-sm"
      style={{ minHeight: "16rem" }}
      role="log"
      aria-live="polite"
    >
      {logs.length === 0 && (
        <p className="text-slate-500">No log lines yet.</p>
      )}
      {logs.map((line) => (
        <LogEntryRow key={line.id} entry={line} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
