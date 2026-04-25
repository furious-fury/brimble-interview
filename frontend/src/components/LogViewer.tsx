import { useMemo, useState } from "react";
import type { DeploymentStatus, LogStageName } from "@/api";
import { BuildTimer, ConnectionStatusBadge, LogFilterButtons, LogTerminal } from "@/components";
import { useLogStream } from "@/hooks";

type LogViewerProps = {
  deploymentId: string;
  status: DeploymentStatus;
  createdAt: string;
  updatedAt: string;
};

/**
 * Real-time log viewer with SSE streaming, filtering, and build timing.
 * Refactored into composable sub-components for maintainability.
 */
export function LogViewer({ deploymentId, status, createdAt, updatedAt }: LogViewerProps) {
  const [filter, setFilter] = useState<"all" | LogStageName>("all");
  const { logs, connectionStatus } = useLogStream(deploymentId);

  const displayLogs = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter((l) => l.stage === filter);
  }, [logs, filter]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Logs
        </p>
        <BuildTimer
          logs={logs}
          status={status}
          createdAt={createdAt}
          updatedAt={updatedAt}
        />
        <LogFilterButtons currentFilter={filter} onFilterChange={setFilter} />
        <ConnectionStatusBadge status={connectionStatus} />
      </div>
      <LogTerminal logs={displayLogs} deploymentId={deploymentId} />
    </div>
  );
}
