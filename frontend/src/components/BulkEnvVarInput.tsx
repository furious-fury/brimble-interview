interface BulkEnvVarInputProps {
  value: string;
  onChange: (val: string) => void;
  onApply: () => void;
  onCancel: () => void;
}

/**
 * Bulk environment variable input via textarea.
 * Accepts KEY=value format, one per line.
 */
export function BulkEnvVarInput({
  value,
  onChange,
  onApply,
  onCancel,
}: BulkEnvVarInputProps) {
  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`DATABASE_URL=postgres://localhost:5432/db\nPORT=3000\nDEBUG=true`}
        className="w-full h-32 rounded-sm border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-800 outline-none transition focus:border-slate-400 resize-none"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onApply}
          className="rounded-sm bg-slate-800 px-3 py-1.5 text-xs font-medium text-blue-50 transition hover:bg-slate-900"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-sm border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
