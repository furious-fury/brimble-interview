import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DeploymentStatus,
  LogEntry,
  LogLevelName,
  LogStageName,
} from "../api/types.js";

const STAGE_FILTERS: Array<"all" | LogStageName> = [
  "all",
  "build",
  "deploy",
  "runtime",
];

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

type Props = { deploymentId: string };

function fmtDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

type LogViewerProps = Props & {
  status: DeploymentStatus;
  createdAt: string;
  updatedAt: string;
};

export function LogViewer({ deploymentId, status, createdAt, updatedAt }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<"all" | LogStageName>("all");
  const [conn, setConn] = useState<
    "connecting" | "live" | "reconnecting" | "error"
  >("connecting");
  const lastIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());

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

  useEffect(() => {
    if (status !== "building") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [status]);

  const display = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter((l) => l.stage === filter);
  }, [logs, filter]);

  const buildStartMs = useMemo(() => {
    // Prefer the first build-stage log line timestamp.
    const firstBuild = logs.find((l) => l.stage === "build");
    if (firstBuild) {
      const t = Date.parse(firstBuild.timestamp);
      if (Number.isFinite(t)) return t;
    }
    // Fallback: if currently building, use the last known deployment update.
    if (status === "building") {
      const t = Date.parse(updatedAt);
      if (Number.isFinite(t)) return t;
    }
    const t = Date.parse(createdAt);
    return Number.isFinite(t) ? t : null;
  }, [createdAt, logs, status, updatedAt]);

  const buildEndMs = useMemo(() => {
    const done = logs.find((l) => l.stage === "build" && l.message.startsWith("Build stage complete."));
    if (!done) return null;
    const t = Date.parse(done.timestamp);
    return Number.isFinite(t) ? t : null;
  }, [logs]);

  const buildElapsed = useMemo(() => {
    if (!buildStartMs) return null;
    const end = status === "building" ? now : buildEndMs;
    if (!end) return null;
    return fmtDuration(end - buildStartMs);
  }, [buildEndMs, buildStartMs, now, status]);

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
        {buildElapsed && (
          <div className="text-xs text-slate-500 tabular-nums">
            {status === "building" ? "Build elapsed: " : "Build time: "}
            <span className="text-slate-700">{buildElapsed}</span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {STAGE_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-sm px-2.5 py-1 text-xs font-medium capitalize transition border ${
                filter === f
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
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
        className="max-h-[min(70vh,600px)] overflow-auto rounded-sm border border-slate-700 bg-slate-800 p-4 font-mono text-sm"
        style={{ minHeight: "16rem" }}
        role="log"
        aria-live="polite"
      >
        {display.length === 0 && (
          <p className="text-slate-500">No log lines yet.</p>
        )}
        {display.map((line) => (
          <div
            key={line.id}
            className="flex flex-wrap gap-x-3 break-words border-b border-slate-700/50 py-1.5 pr-2 last:border-0"
          >
            <span className="shrink-0 text-slate-500 tabular-nums">
              {timeFmt(line.timestamp)}
            </span>
            <span className={`shrink-0 ${stageClass()}`}>
              [{line.stage}]
            </span>
            <span className={`shrink-0 ${levelClass(line.level)}`}>
              {line.level}
            </span>
            <span className="min-w-0 text-slate-300">{line.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
