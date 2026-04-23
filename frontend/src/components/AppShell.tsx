import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Rocket } from "lucide-react";

type AppShellProps = { children: ReactNode };

export function AppShell({ children }: AppShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Simple top header */}
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold text-slate-800"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-slate-100 text-slate-700">
              <Rocket className="h-4 w-4" strokeWidth={1.75} />
            </span>
            Brimble
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              to="/"
              className={`font-medium transition-colors ${
                isHome
                  ? "text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Hub
            </Link>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          {children}
        </div>
      </main>
    </div>
  );
}
