import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ExternalLink,
  Trash2,
  RotateCcw,
  Eye,
  EyeOff,
} from "lucide-react";
import { deleteDeployment, getDeployment, redeployDeployment } from "../api/deploymentsApi.js";
import { ApiError } from "../api/client.js";
import { queryKeys } from "../api/queryKeys.js";
import { shouldPollSingle } from "../lib/deploymentStatus.js";
import { LogViewer } from "./LogViewer.js";
import { StatusBadge } from "./StatusBadge.js";
import { useState } from "react";

function parseEnvVars(envVarsJson: string | null): Record<string, string> {
  if (!envVarsJson) return {};
  try {
    return JSON.parse(envVarsJson) as Record<string, string>;
  } catch {
    return {};
  }
}

export function DeploymentDetailPage() {
  const { deploymentId } = useParams({
    from: "/deployments/$deploymentId",
  });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmRedeployOpen, setConfirmRedeployOpen] = useState(false);
  const [showEnvVars, setShowEnvVars] = useState(false);

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
      setConfirmDeleteOpen(false);
      await qc.invalidateQueries({ queryKey: queryKeys.deployments() });
      void navigate({ to: "/" });
    },
  });

  const redeploy = useMutation({
    mutationFn: () => redeployDeployment(deploymentId),
    onSuccess: async () => {
      setConfirmRedeployOpen(false);
      await qc.invalidateQueries({ queryKey: queryKeys.deployment(deploymentId) });
    },
  });

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-40 animate-pulse rounded-sm bg-slate-100" />
        <div className="h-32 animate-pulse rounded-sm bg-slate-100" />
        <div className="h-64 animate-pulse rounded-sm bg-slate-100" />
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
      <div className="rounded-sm border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-medium">
          {is404 ? "Deployment not found" : "Could not load deployment"}
        </p>
        <p className="mt-1">{msg}</p>
        <Link
          to="/"
          className="mt-4 inline-block text-sm font-medium text-slate-700 hover:underline"
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

  const envVars = parseEnvVars(d.envVars);
  const hasEnvVars = Object.keys(envVars).length > 0;

  return (
    <div>
      <div className="mb-8">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Hub
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Deployment
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-800">
              {d.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={d.status} />
              <code className="font-mono text-xs text-slate-400">{d.id.slice(0, 8)}</code>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {d.url && (
              <a
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
              >
                Open app
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setConfirmRedeployOpen(true)}
              disabled={redeploy.isPending}
              className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className={`h-4 w-4 ${redeploy.isPending ? "animate-spin" : ""}`} />
              {redeploy.isPending ? "Redeploying…" : "Redeploy"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={del.isPending}
              className="inline-flex items-center gap-1.5 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-sm border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Source
          </p>
          <p className="mt-1 break-all font-mono text-sm text-slate-700">
            {d.source}
          </p>
          {d.sourceRef && (
            <p className="mt-1 text-sm text-slate-500">Ref: {d.sourceRef}</p>
          )}
        </div>
        <div className="rounded-sm border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Network
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {d.port != null ? (
              <span>
                Port <span className="font-mono tabular-nums">{d.port}</span> (host)
              </span>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </p>
        </div>
      </div>

      {hasEnvVars && (
        <div className="mb-8 rounded-sm border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Environment Variables
            </p>
            <button
              type="button"
              onClick={() => setShowEnvVars(!showEnvVars)}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            >
              {showEnvVars ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  Show
                </>
              )}
            </button>
          </div>
          <div className="mt-2 space-y-1 font-mono text-sm">
            {Object.entries(envVars).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-slate-600">{key}=</span>
                <span className="text-slate-800">
                  {showEnvVars ? value : "•".repeat(Math.min(value.length, 20))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <LogViewer
        deploymentId={deploymentId}
        status={d.status}
        createdAt={d.createdAt}
        updatedAt={d.updatedAt}
      />

      {/* Redeploy Confirmation Modal */}
      {confirmRedeployOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="redeploy-confirm-title"
        >
          <div className="w-full max-w-md rounded-sm bg-white p-6">
            <h2
              id="redeploy-confirm-title"
              className="text-lg font-semibold text-slate-800"
            >
              Redeploy this deployment?
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              This will destroy the current container, clear all logs, and start a fresh deployment. 
              The current container and logs will be permanently lost.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRedeployOpen(false)}
                className="rounded-sm border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => redeploy.mutate()}
                disabled={redeploy.isPending}
                className="rounded-sm bg-slate-800 px-4 py-2 text-sm font-medium text-blue-50 hover:bg-slate-900 disabled:opacity-50"
              >
                {redeploy.isPending ? "Redeploying…" : "Redeploy"}
              </button>
            </div>
            {redeploy.isError && (
              <p className="mt-3 text-sm text-red-700">
                {redeploy.error instanceof ApiError
                  ? redeploy.error.message
                  : (redeploy.error as Error).message}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="delete-confirm-title"
        >
          <div className="w-full max-w-md rounded-sm bg-white p-6">
            <h2
              id="delete-confirm-title"
              className="text-lg font-semibold text-slate-800"
            >
              Delete this deployment?
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              The container, logs, and Caddy route will be removed. This cannot
              be undone.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="rounded-sm border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className="rounded-sm bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
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
