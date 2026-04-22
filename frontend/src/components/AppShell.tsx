import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LayoutGrid, Rocket } from "lucide-react";

type AppShellProps = { children: ReactNode };

export function AppShell({ children }: AppShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hub = pathname === "/";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile / narrow: top bar */}
      <header className="border-b border-white/20 bg-white/15 px-4 py-3 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold text-slate-800"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/40 text-indigo-600">
              <Rocket className="h-5 w-5" strokeWidth={1.75} />
            </span>
            Brimble
          </Link>
        </div>
      </header>

      {/* Desktop glass rail */}
      <aside
        className="hidden w-60 shrink-0 flex-col border-r border-white/20 bg-white/20 p-4 pt-6 backdrop-blur-2xl md:flex"
        style={{ minHeight: "100vh" }}
      >
        <Link
          to="/"
          className="mb-8 flex items-center gap-2 px-1 font-bold tracking-tight text-slate-900"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/50 text-indigo-600 shadow-sm">
            <Rocket className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="text-lg">Brimble</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          <p className="px-2 text-xs font-medium uppercase tracking-widest text-slate-500">
            App
          </p>
          <Link
            to="/"
            className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              hub
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:bg-white/40"
            }`}
          >
            <LayoutGrid className="h-4 w-4 shrink-0 opacity-70" />
            Hub
          </Link>
        </nav>
        <p className="px-2 pt-4 text-xs leading-relaxed text-slate-500">
          One-node deploy pipeline. Create from Git or upload, then follow logs
          live.
        </p>
      </aside>

      <div className="min-h-0 flex-1 p-3 sm:p-4 md:py-8 md:pl-2 md:pr-8">
        <div
          className="mx-auto max-w-5xl rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6 md:p-8"
          style={{ minHeight: "min(70vh, 900px)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
