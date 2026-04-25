import type { LogStageName } from "../api/types.js";

const STAGE_FILTERS: Array<"all" | LogStageName> = [
  "all",
  "build",
  "deploy",
  "runtime",
];

interface LogFilterButtonsProps {
  currentFilter: "all" | LogStageName;
  onFilterChange: (filter: "all" | LogStageName) => void;
}

/**
 * Filter button group for log stages (all/build/deploy/runtime).
 */
export function LogFilterButtons({ currentFilter, onFilterChange }: LogFilterButtonsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STAGE_FILTERS.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onFilterChange(f)}
          className={`rounded-sm px-2.5 py-1 text-xs font-medium capitalize transition border ${
            currentFilter === f
              ? "border-slate-800 bg-slate-800 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
