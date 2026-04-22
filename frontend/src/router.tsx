import { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { AppShell } from "./components/AppShell.js";
import { DeploymentDetailPage } from "./components/DeploymentDetailPage.js";
import { HubPage } from "./components/HubPage.js";

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
