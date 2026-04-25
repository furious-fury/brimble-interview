import { ApiError } from "@/api";

interface DeleteDeploymentModalProps {
  isOpen: boolean;
  isPending: boolean;
  error: Error | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation modal for deleting a deployment.
 */
export function DeleteDeploymentModal({
  isOpen,
  isPending,
  error,
  onCancel,
  onConfirm,
}: DeleteDeploymentModalProps) {
  if (!isOpen) return null;

  return (
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
            onClick={onCancel}
            className="rounded-sm border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-sm bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
          >
            {isPending ? "Deleting…" : "Delete"}
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
