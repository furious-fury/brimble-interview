import { Link, useParams, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ExternalLink,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { ApiError } from "@/api";
import { parseEnvVars } from "@/lib";
import {
  LogViewer,
  StatusBadge,
  DeleteDeploymentModal,
  RedeployModal,
  EnvVarDisplay,
  SkeletonGroup,
  Card,
} from "@/components";
import {
  useDeploymentQuery,
  useDeploymentActions,
  useToastActions,
} from "@/hooks";
import { useState } from "react";

/**
 * Deployment detail page with logs, status, and actions.
 * Uses extracted hooks for data fetching and mutations.
 */
export function DeploymentDetailPage() {
  const { deploymentId } = useParams({
    from: "/deployments/$deploymentId",
  });
  const navigate = useNavigate();
  const { showLoading, removeToast, showError } = useToastActions();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmRedeployOpen, setConfirmRedeployOpen] = useState(false);
  const [deleteToastId, setDeleteToastId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const q = useDeploymentQuery(deploymentId, isDeleting);
  const actions = useDeploymentActions({
    deploymentId,
    onDeleteStart: () => {
      setConfirmDeleteOpen(false);
      setIsDeleting(true);
      // Show loading toast - will stay until delete completes
      const toastId = showLoading("Deleting deployment... Container cleanup in progress");
      setDeleteToastId(toastId);
    },
    onDeleteSuccess: () => {
      // Remove loading toast
      if (deleteToastId) {
        removeToast(deleteToastId);
      }
      // Show success then navigate to hub
      navigate({ to: "/" });
    },
    onDeleteError: (error) => {
      // Remove loading toast and show error
      if (deleteToastId) {
        removeToast(deleteToastId);
      }
      showError(error.message || "Delete failed");
    },
    onRedeploySuccess: () => setConfirmRedeployOpen(false),
  });

  if (q.isLoading) {
    return <SkeletonGroup lines={3} />;
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
              disabled={actions.redeploy.isPending}
              className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className={`h-4 w-4 ${actions.redeploy.isPending ? "animate-spin" : ""}`} />
              {actions.redeploy.isPending ? "Redeploying…" : "Redeploy"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={actions.delete.isPending}
              className="inline-flex items-center gap-1.5 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <Card title="Source">
          <p className="break-all font-mono text-sm text-slate-700">
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
        </Card>
        <Card title="Network">
          {d.url ? (
            <a
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="block break-all text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              {d.url}
            </a>
          ) : d.port != null ? (
            <p className="text-sm text-slate-700">
              <span>
                Port <span className="font-mono tabular-nums">{d.port}</span> (host)
              </span>
            </p>
          ) : (
            <p className="text-sm text-slate-400">—</p>
          )}
        </Card>
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
        isPending={actions.redeploy.isPending}
        error={actions.redeploy.error as Error | null}
        onCancel={() => setConfirmRedeployOpen(false)}
        onConfirm={() => actions.redeploy.mutate()}
      />

      <DeleteDeploymentModal
        isOpen={confirmDeleteOpen}
        isPending={actions.delete.isPending}
        error={actions.delete.error as Error | null}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => actions.delete.mutate()}
      />
    </div>
  );
}
