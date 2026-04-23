import type { DeploymentStatus } from "../api/types.js";

const map: Record<
  DeploymentStatus,
  { className: string; label: string }
> = {
  pending: {
    className: "bg-slate-100 text-slate-600",
    label: "Pending",
  },
  building: {
    className: "bg-slate-100 text-slate-700",
    label: "Building",
  },
  deploying: {
    className: "bg-blue-50 text-blue-700",
    label: "Deploying",
  },
  running: {
    className: "bg-emerald-50 text-emerald-700",
    label: "Running",
  },
  failed: {
    className: "bg-red-50 text-red-700",
    label: "Failed",
  },
};

export function StatusBadge({ status }: { status: DeploymentStatus }) {
  const s = map[status] ?? map.pending;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}
    >
      {s.label}
    </span>
  );
}
