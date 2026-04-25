import { Eye, EyeOff, FileText } from "lucide-react";

interface EnvVarControlsProps {
  showValues: boolean;
  onToggleShow: () => void;
  onBulkClick: () => void;
}

/**
 * Environment variable input controls (show/hide, bulk edit).
 */
export function EnvVarControls({
  showValues,
  onToggleShow,
  onBulkClick,
}: EnvVarControlsProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
        Environment Variables
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleShow}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          {showValues ? (
            <>
              <EyeOff className="h-3.5 w-3.5" />
              Hide
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5" />
              Show
            </>
          )}
        </button>
        <span className="text-slate-300">|</span>
        <button
          type="button"
          onClick={onBulkClick}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <FileText className="h-3.5 w-3.5" />
          Bulk
        </button>
      </div>
    </div>
  );
}
