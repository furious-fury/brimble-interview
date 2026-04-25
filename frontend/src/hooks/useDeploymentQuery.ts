import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDeployment, queryKeys } from "@/api";
import { shouldPollSingle } from "@/lib";

/**
 * Hook to fetch a single deployment with auto-polling for in-flight statuses.
 * @param deploymentId - The deployment ID to fetch
 * @param isDeleting - If true, disables the query to prevent 404 errors during delete
 */
export function useDeploymentQuery(deploymentId: string, isDeleting = false) {
  return useQuery({
    queryKey: queryKeys.deployment(deploymentId),
    queryFn: () => getDeployment(deploymentId),
    refetchInterval: (query) => {
      if (isDeleting) return false;
      const d = query.state.data;
      if (!d) return 3000;
      return shouldPollSingle(d.status) ? 3000 : false;
    },
    enabled: !isDeleting,
  });
}

/**
 * Hook to access the query client for this deployment.
 */
export function useDeploymentQueryClient(deploymentId: string) {
  const qc = useQueryClient();

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.deployment(deploymentId) });
  };

  return { invalidate };
}
