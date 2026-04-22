import { useEffect, useMemo, useRef, useState } from "react";
import type { LogEntry, LogLevelName, LogStageName } from "../api/types.js";

const STAGE_FILTERS: Array<"all" | LogStageName> = [
  "all",
  "build",
  "deploy",
  "runtime",
];

function levelClass(level: LogLevelName): string {
  switch (level) {
    case "error":
      return "text-red-400";
    case "warn":
      return "text-amber-300";
    case "debug":
      return "text-slate-500";
    case "info":
    default:
      return "text-emerald-200/90";
  }
}

type Props = { deploymentId: string };

export function LogViewer({ deploymentId }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<"all" | LogStageName>("all");
  const [conn, setConn] = useState<
    "connecting" | "live" | "reconnecting" | "error"
  >("connecting");
  const lastIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogs([]);
    lastIdRef.current = null;
    setConn("connecting");

    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;

    const open = (after: string | null) => {
      if (!active) return;
      const q = after
        ? `?afterId=${encodeURIComponent(after)}`
        : "";
      es = new EventSource(`/api/deployments/${deploymentId}/logs${q}`);
      if (after) setConn("reconnecting");
      else setConn("connecting");

      const onLog = (e: Event) => {
        const data = JSON.parse(
          (e as MessageEvent).data as string
        ) as LogEntry;
        setLogs((prev) => {
          if (prev.some((l) => l.id === data.id)) return prev;
          return [...prev, data];
        });
        lastIdRef.current = data.id;
      };

      es.addEventListener("log", onLog);
      es.addEventListener("replay_done", () => {
        if (active) setConn("live");
      });
      es.onerror = () => {
        if (!active) return;
        try {
          es?.close();
        } catch {
          // ignore
        }
        if (!active) return;
        setConn("reconnecting");
        const cursor = lastIdRef.current;
        timer = setTimeout(() => {
          if (active) open(cursor);
        }, 1500);
      };
    };

    open(null);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      try {
        es?.close();
      } catch {
        // ignore
      }
    };
  }, [deploymentId]);

  const display = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter((l) => l.stage === filter);
  }, [logs, filter]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [display.length, deploymentId]);

  const timeFmt = (iso: string) => {
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
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Logs
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {STAGE_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                filter === f
                  ? "bg-white/20 text-white"
                  : "bg-slate-700/80 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="ml-auto min-w-0 text-xs text-slate-500">
          {conn === "connecting" && "Connecting…"}
          {conn === "live" && "Live"}
          {conn === "reconnecting" && "Reconnecting…"}
        </div>
      </div>
      <div
        className="log-line max-h-[min(50vh,420px)] overflow-auto rounded-2xl border border-slate-600/50 bg-slate-950 p-3 text-slate-200"
        style={{ minHeight: "12rem" }}
        role="log"
        aria-live="polite"
      >
        {display.length === 0 && (
          <p className="p-2 text-slate-500">No log lines yet.</p>
        )}
        {display.map((line) => (
          <div
            key={line.id}
            className="flex flex-wrap gap-x-2 break-words border-b border-slate-800/60 py-1 pr-1 last:border-0"
          >
            <span className="shrink-0 text-slate-500 tabular-nums">
              {timeFmt(line.timestamp)}
            </span>
            <span className="shrink-0 text-slate-400">[{line.stage}]</span>
            <span className={`shrink-0 ${levelClass(line.level)}`}>
              {line.level}
            </span>
            <span className="min-w-0 text-slate-200">{line.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
