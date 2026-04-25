import { ApiError } from "@/api";

interface RedeployModalProps {
  isOpen: boolean;
  isPending: boolean;
  error: Error | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation modal for redeploying a deployment.
 */
export function RedeployModal({
  isOpen,
  isPending,
  error,
  onCancel,
  onConfirm,
}: RedeployModalProps) {
  if (!isOpen) return null;

  return (
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
            onClick={onCancel}
            className="rounded-sm border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-sm bg-slate-800 px-4 py-2 text-sm font-medium text-blue-50 hover:bg-slate-900 disabled:opacity-50"
          >
            {isPending ? "Redeploying…" : "Redeploy"}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-700">
            {error instanceof ApiError
              ? error.message
              : error.message}
          </p>
        )}
      </div>
    </div>
  );
}
