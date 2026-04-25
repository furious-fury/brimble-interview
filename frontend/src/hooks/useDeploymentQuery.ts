import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getDeployment, queryKeys } from "@/api";
import { shouldPollSingle } from "@/lib";

/**
 * Hook to fetch a single deployment with auto-polling for in-flight statuses.
 */
export function useDeploymentQuery(deploymentId: string) {
  const [isDeleted] = useState(false);

  return useQuery({
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
