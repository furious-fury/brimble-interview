import type { DeploymentStatus } from "../api/types.js";

const map: Record<
  DeploymentStatus,
  { className: string; label: string }
> = {
  pending: {
    className: "bg-slate-100 text-slate-700 ring-slate-200/80",
    label: "Pending",
  },
  building: {
    className: "bg-indigo-50 text-indigo-800 ring-indigo-200/60",
    label: "Building",
  },
  deploying: {
    className: "bg-sky-50 text-sky-800 ring-sky-200/60",
    label: "Deploying",
  },
  running: {
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200/60",
    label: "Running",
  },
  failed: {
    className: "bg-red-50 text-red-800 ring-red-200/60",
    label: "Failed",
  },
};

export function StatusBadge({ status }: { status: DeploymentStatus }) {
  const s = map[status] ?? map.pending;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.className}`}
    >
      {s.label}
    </span>
  );
}
