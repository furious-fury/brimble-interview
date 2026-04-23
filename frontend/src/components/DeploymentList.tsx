import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink, RefreshCw } from "lucide-react";
import { listDeployments } from "../api/deploymentsApi.js";
import { queryKeys } from "../api/queryKeys.js";
import { listHasInFlight } from "../lib/deploymentStatus.js";
import { StatusBadge } from "./StatusBadge.js";
import { ApiError } from "../api/client.js";

function formatWhen(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

export function DeploymentList() {
  const q = useQuery({
    queryKey: queryKeys.deployments(),
    queryFn: () => listDeployments(100),
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return 3000;
      return listHasInFlight(d) ? 3000 : false;
    },
  });

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-20 animate-pulse rounded-sm bg-slate-100" />
        <div className="h-20 animate-pulse rounded-sm bg-slate-100" />
        <div className="h-20 animate-pulse rounded-sm bg-slate-100" />
      </div>
    );
  }

  if (q.isError) {
    const msg =
      q.error instanceof ApiError
        ? q.error.message
        : (q.error as Error).message;
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="font-medium">Could not load deployments</p>
        <p className="mt-1">{msg}</p>
        <button
          type="button"
          onClick={() => void q.refetch()}
          className="mt-3 rounded-sm border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Retry
        </button>
      </div>
    );
  }

  const data = q.data ?? [];
  if (!data.length) {
    return (
      <div className="rounded-sm border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
        <p className="font-medium text-slate-700">No deployments yet</p>
        <p className="mt-1 text-sm text-slate-500">
          Create one from the "New deployment" tab to get started.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {data.length} deployment{data.length === 1 ? "" : "s"}
          {q.isFetching && <span className="ml-2 text-slate-400">(updating…)</span>}
        </p>
        <button
          type="button"
          onClick={() => void q.refetch()}
          className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      <div className="space-y-0 divide-y divide-slate-200 rounded-sm border border-slate-200 bg-white">
        {data.map((d) => (
          <div
            key={d.id}
            className="p-4 transition hover:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <Link
                    to="/deployments/$deploymentId"
                    params={{ deploymentId: d.id }}
                    className="font-medium text-slate-800 hover:underline"
                  >
                    {d.name}
                  </Link>
                  <StatusBadge status={d.status} />
                </div>
                
                <div className="mt-1.5 flex items-center gap-2 text-xs">
                  {d.imageTag ? (
                    <code className="font-mono text-slate-500">{d.imageTag}</code>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                  {d.sourceType === "git" && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="font-mono text-slate-400">{d.sourceRef || "main"}</span>
                    </>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-4 text-sm">
                  {d.url ? (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-800 hover:underline"
                    >
                      {d.url.replace(/^https?:\/\//, "")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-slate-400">No URL</span>
                  )}
                  <span className="text-xs text-slate-400 tabular-nums">
                    {formatWhen(d.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
