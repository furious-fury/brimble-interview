import { Trash2 } from "lucide-react";

interface EnvVarRowProps {
  keyValue: string;
  value: string;
  showValues: boolean;
  canRemove: boolean;
  onKeyChange: (val: string) => void;
  onValueChange: (val: string) => void;
  onRemove: () => void;
}

/**
 * Single environment variable key-value input row.
 */
export function EnvVarRow({
  keyValue,
  value,
  showValues,
  canRemove,
  onKeyChange,
  onValueChange,
  onRemove,
}: EnvVarRowProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={keyValue}
        onChange={(e) => onKeyChange(e.target.value)}
        placeholder="KEY"
        className="flex-1 rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-400 font-mono"
      />
      <span className="text-slate-400">=</span>
      <input
        type={showValues ? "text" : "password"}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder="value"
        className="flex-[2] rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-400 font-mono"
      />
      <button
        type="button"
        onClick={onRemove}
        className="flex h-9 w-9 items-center justify-center rounded-sm border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
        disabled={!canRemove}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
