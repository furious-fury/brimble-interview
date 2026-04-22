import { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Link,
  Outlet,
} from "@tanstack/react-router";
import { useState } from "react";

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: function RootLayout() {
    return (
      <div className="layout">
        <header
          className="header"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <strong>Brimble</strong>
          <Link to="/">Home</Link>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    );
  },
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: function Home() {
    return (
      <section>
        <h1>One-page deployment pipeline</h1>
        <p>
          Foundation phase: API and UI are wired through Caddy on port 80 in Docker.
        </p>
        <p>
          Try <code>GET /api/health</code> via the proxy or the button below.
        </p>
        <HealthButton />
      </section>
    );
  },
});

function HealthButton() {
  const [r, setR] = useState<string | null>(null);
  return (
    <p>
      <button
        type="button"
        onClick={async () => {
          const res = await fetch("/api/health");
          const j = (await res.json()) as unknown;
          setR(JSON.stringify(j, null, 2));
        }}
      >
        Check API health
      </button>
      {r && <pre style={{ marginTop: 8 }}>{r}</pre>}
    </p>
  );
}

export const routeTree = rootRoute.addChildren([homeRoute]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
  });
}
