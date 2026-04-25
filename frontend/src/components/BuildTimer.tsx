import { useEffect, useMemo, useState } from "react";
import type { DeploymentStatus, LogEntry } from "../api/types.js";

function fmtDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

interface BuildTimerProps {
  logs: LogEntry[];
  status: DeploymentStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Displays elapsed or total build time based on log timestamps.
 */
export function BuildTimer({ logs, status, createdAt, updatedAt }: BuildTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "building") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [status]);

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

  if (!buildElapsed) return null;

  return (
    <div className="text-xs text-slate-500 tabular-nums">
      {status === "building" ? "Build elapsed: " : "Build time: "}
      <span className="text-slate-700">{buildElapsed}</span>
    </div>
  );
}
