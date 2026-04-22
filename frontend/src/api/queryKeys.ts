export const queryKeys = {
  deployments: () => ["deployments"] as const,
  deployment: (id: string) => ["deployments", id] as const,
};
