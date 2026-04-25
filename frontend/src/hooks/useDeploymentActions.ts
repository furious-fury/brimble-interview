import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { deleteDeployment, redeployDeployment } from "@/api";

interface UseDeploymentActionsOptions {
  deploymentId: string;
  onDeleteStart?: () => void;
  onRedeploySuccess?: () => void;
}

/**
 * Hook for deployment actions (delete, redeploy) with optimistic updates.
 */
export function useDeploymentActions({
  deploymentId,
  onDeleteStart,
  onRedeploySuccess,
}: UseDeploymentActionsOptions) {
  const navigate = useNavigate();

  const deleteMutation = useMutation({
    mutationFn: () => deleteDeployment(deploymentId),
    onMutate: () => {
      // Close modal and trigger callback
      onDeleteStart?.();
      // Navigate to hub immediately with deleting state (optimistic)
      navigate({
        to: "/",
        search: { deleting: "true", deploymentId },
      });
    },
    onError: (error) => {
      // Error will be handled by the hub showing error toast
      console.error("Delete failed:", error);
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
