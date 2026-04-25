import { useMutation } from "@tanstack/react-query";
import { deleteDeployment, redeployDeployment } from "@/api";

interface UseDeploymentActionsOptions {
  deploymentId: string;
  onDeleteStart?: () => void;
  onDeleteSuccess?: () => void;
  onDeleteError?: (error: Error) => void;
  onRedeploySuccess?: () => void;
}

/**
 * Hook for deployment actions (delete, redeploy).
 * Delete waits for API completion before calling onDeleteSuccess.
 */
export function useDeploymentActions({
  deploymentId,
  onDeleteStart,
  onDeleteSuccess,
  onDeleteError,
  onRedeploySuccess,
}: UseDeploymentActionsOptions) {
  const deleteMutation = useMutation({
    mutationFn: () => deleteDeployment(deploymentId),
    onMutate: () => {
      onDeleteStart?.();
    },
    onSuccess: () => {
      onDeleteSuccess?.();
    },
    onError: (error) => {
      onDeleteError?.(error instanceof Error ? error : new Error(String(error)));
    },
  });

  const redeployMutation = useMutation({
    mutationFn: () => redeployDeployment(deploymentId),
    onSuccess: () => {
      onRedeploySuccess?.();
    },
  });

  return {
    delete: deleteMutation,
    redeploy: redeployMutation,
  };
}
