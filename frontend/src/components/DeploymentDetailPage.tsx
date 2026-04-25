import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ExternalLink,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { deleteDeployment, getDeployment, redeployDeployment } from "../api/deploymentsApi.js";
import { ApiError } from "../api/client.js";
import { queryKeys } from "../api/queryKeys.js";
import { shouldPollSingle } from "../lib/deploymentStatus.js";
import { LogViewer } from "./LogViewer.js";
import { StatusBadge } from "./StatusBadge.js";
import { useState } from "react";
import { DeleteDeploymentModal } from "./modals/DeleteDeploymentModal.js";
import { RedeployModal } from "./modals/RedeployModal.js";
import { EnvVarDisplay } from "./EnvVarDisplay.js";
import { useToastActions } from "../hooks/useToast.js";

function parseEnvVars(envVarsJson: string | null): Record<string, string> {
  if (!envVarsJson) return {};
  try {
    return JSON.parse(envVarsJson) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Deployment detail page with logs, status, and actions.
 * Refactored to use composable modal components.
 */
export function DeploymentDetailPage() {
  const { deploymentId } = useParams({
    from: "/deployments/$deploymentId",
  });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showLoading, showSuccess, showError, removeToast } = useToastActions();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmRedeployOpen, setConfirmRedeployOpen] = useState(false);
  const [deleteToastId, setDeleteToastId] = useState<string | null>(null);

  const [isDeleted, setIsDeleted] = useState(false);

  const q = useQuery({
    queryKey: queryKeys.deployment(deploymentId),
    queryFn: () => getDeployment(deploymentId),
    refetchInterval: (query) => {
      if (isDeleted) return false;
      const d = query.state.data;
      if (!d) return 3000;
      return shouldPollSingle(d.status) ? 3000 : false;
    },
    enabled: !isDeleted,
  });

  const del = useMutation({
    mutationFn: () => deleteDeployment(deploymentId),
    onMutate: () => {
      // Close modal immediately for better UX
      setConfirmDeleteOpen(false);
      // Show loading toast (minimum 2 seconds for visibility)
      const toastId = showLoading("Deleting deployment...");
      setDeleteToastId(toastId);
    },
    onSuccess: () => {
      // Navigate to hub immediately - toast will show there
      void navigate({ to: "/", search: { deleted: "true" } });
    },
    onError: (error) => {
      // Remove loading toast immediately
      if (deleteToastId) {
        removeToast(deleteToastId);
      }
      // Show error toast (5 seconds)
      const message = error instanceof ApiError 
        ? error.message 
        : "Failed to delete deployment";
      showError(message, 5000);
      setDeleteToastId(null);
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
          {d.commitId && (
            <p className="mt-1 text-sm text-slate-500 font-mono">
              Commit: <span className="text-xs">{d.commitId.slice(0, 7)}</span>
            </p>
          )}
        </div>
        <div className="rounded-sm border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Network
          </p>
          {d.url ? (
            <a 
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              {d.url}
            </a>
          ) : d.port != null ? (
            <p className="mt-1 text-sm text-slate-700">
              <span>
                Port <span className="font-mono tabular-nums">{d.port}</span> (host)
              </span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-400">—</p>
          )}
        </div>
      </div>

      <EnvVarDisplay envVars={envVars} />

      <LogViewer
        deploymentId={deploymentId}
        status={d.status}
        createdAt={d.createdAt}
        updatedAt={d.updatedAt}
      />

      <RedeployModal
        isOpen={confirmRedeployOpen}
        isPending={redeploy.isPending}
        error={redeploy.error as Error | null}
        onCancel={() => setConfirmRedeployOpen(false)}
        onConfirm={() => redeploy.mutate()}
      />

      <DeleteDeploymentModal
        isOpen={confirmDeleteOpen}
        isPending={del.isPending}
        error={del.error as Error | null}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => del.mutate()}
      />
    </div>
  );
}
