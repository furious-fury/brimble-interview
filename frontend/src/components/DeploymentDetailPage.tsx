import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { deleteDeployment, getDeployment } from "../api/deploymentsApi.js";
import { ApiError } from "../api/client.js";
import { queryKeys } from "../api/queryKeys.js";
import { shouldPollSingle } from "../lib/deploymentStatus.js";
import { LogViewer } from "./LogViewer.js";
import { StatusBadge } from "./StatusBadge.js";
import { useState } from "react";

export function DeploymentDetailPage() {
  const { deploymentId } = useParams({
    from: "/deployments/$deploymentId",
  });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const q = useQuery({
    queryKey: queryKeys.deployment(deploymentId),
    queryFn: () => getDeployment(deploymentId),
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return 3000;
      return shouldPollSingle(d.status) ? 3000 : false;
    },
  });

  const del = useMutation({
    mutationFn: () => deleteDeployment(deploymentId),
    onSuccess: async () => {
      setConfirmOpen(false);
      await qc.invalidateQueries({ queryKey: queryKeys.deployments() });
      void navigate({ to: "/" });
    },
  });

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-100" />
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (q.isError) {
    const msg =
      q.error instanceof ApiError
        ? q.error.message
        : (q.error as Error).message;
    const is404 = q.error instanceof ApiError && q.error.status === 404;
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <p className="font-medium">
          {is404 ? "Deployment not found" : "Could not load deployment"}
        </p>
        <p className="mt-1">{msg}</p>
        <Link
          to="/"
          className="mt-4 inline-block text-sm font-medium text-indigo-700 hover:underline"
        >
          Back to hub
        </Link>
      </div>
    );
  }

  const d = q.data;
  if (!d) {
    return null;
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Hub
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Deployment
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
              {d.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={d.status} />
              <span className="font-mono text-xs text-slate-500">{d.id}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {d.url && (
              <a
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-600 shadow-sm transition hover:bg-slate-50"
              >
                Open app
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={del.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Source
          </p>
          <p className="mt-1 break-all font-mono text-sm text-slate-800">
            {d.source}
          </p>
          {d.sourceRef && (
            <p className="mt-1 text-sm text-slate-600">Ref: {d.sourceRef}</p>
          )}
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Network
          </p>
          <p className="mt-1 text-sm text-slate-800">
            {d.port != null ? (
              <span>
                Port <span className="tabular-nums">{d.port}</span> (host)
              </span>
            ) : (
              <span className="text-slate-500">—</span>
            )}
          </p>
        </div>
      </div>

      <LogViewer
        deploymentId={deploymentId}
        status={d.status}
        createdAt={d.createdAt}
        updatedAt={d.updatedAt}
      />

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="delete-confirm-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2
              id="delete-confirm-title"
              className="text-lg font-semibold text-slate-900"
            >
              Delete this deployment?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              The container, logs, and Caddy route will be removed. This cannot
              be undone.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {del.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
            {del.isError && (
              <p className="mt-3 text-sm text-red-700">
                {del.error instanceof ApiError
                  ? del.error.message
                  : (del.error as Error).message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
