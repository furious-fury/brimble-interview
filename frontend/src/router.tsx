import { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { AppShell, DeploymentDetailPage, HubPage } from "@/components";

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: function RootLayout() {
    return (
      <AppShell>
        <Outlet />
      </AppShell>
    );
  },
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HubPage,
  validateSearch: (search: Record<string, unknown>) => ({
    deleted: search.deleted === "true" ? "true" : undefined,
    deleting: search.deleting === "true" ? "true" : undefined,
    deploymentId: typeof search.deploymentId === "string" ? search.deploymentId : undefined,
  }),
});

const deploymentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "deployments/$deploymentId",
  component: DeploymentDetailPage,
});

const routeTree = rootRoute.addChildren([homeRoute, deploymentRoute]);

export { routeTree, homeRoute, deploymentRoute, rootRoute };

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
  });
}
