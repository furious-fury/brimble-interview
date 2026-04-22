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
    return new Date(iso).toLocaleString();
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
      <div className="space-y-3">
        <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (q.isError) {
    const msg =
      q.error instanceof ApiError
        ? q.error.message
        : (q.error as Error).message;
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-medium">Could not load deployments</p>
        <p className="mt-1">{msg}</p>
        <button
          type="button"
          onClick={() => void q.refetch()}
          className="mt-3 rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-200"
        >
          Retry
        </button>
      </div>
    );
  }

  const data = q.data ?? [];
  if (!data.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center">
        <p className="font-medium text-slate-700">No deployments yet</p>
        <p className="mt-1 text-sm text-slate-500">
          Create one from the &quot;New deployment&quot; tab to get started.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {data.length} deployment{data.length === 1 ? "" : "s"}{" "}
          {q.isFetching && <span className="text-slate-400">(updating…)</span>}
        </p>
        <button
          type="button"
          onClick={() => void q.refetch()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>
      <div className="md:hidden space-y-3">
        {data.map((d) => (
          <div
            key={d.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link
                  to="/deployments/$deploymentId"
                  params={{ deploymentId: d.id }}
                  className="font-semibold text-indigo-700 hover:underline"
                >
                  {d.name}
                </Link>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  {d.sourceType === "git" ? d.source : "upload"}
                </p>
              </div>
              <StatusBadge status={d.status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              {d.url ? (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-600"
                >
                  Open app
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span className="text-slate-400">No URL</span>
              )}
              <span
                className="tabular-nums text-xs text-slate-500"
                title={d.updatedAt}
              >
                {formatWhen(d.updatedAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 md:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="p-3 font-medium text-slate-600">Name</th>
              <th className="p-3 font-medium text-slate-600">Status</th>
              <th className="p-3 font-medium text-slate-600">Source</th>
              <th className="p-3 font-medium text-slate-600">URL</th>
              <th className="p-3 font-medium text-slate-600">Updated</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr
                key={d.id}
                className="border-b border-slate-100 transition hover:bg-slate-50/80"
              >
                <td className="p-3">
                  <Link
                    to="/deployments/$deploymentId"
                    params={{ deploymentId: d.id }}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {d.name}
                  </Link>
                </td>
                <td className="p-3">
                  <StatusBadge status={d.status} />
                </td>
                <td className="max-w-[200px] truncate p-3 font-mono text-xs text-slate-600">
                  {d.sourceType === "git" ? d.source : "upload"}
                </td>
                <td className="p-3">
                  {d.url ? (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                    >
                      Open
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td
                  className="p-3 tabular-nums text-slate-500"
                  title={d.updatedAt}
                >
                  {formatWhen(d.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
