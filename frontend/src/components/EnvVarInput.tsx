import { useState, useId } from "react";
import { Eye, EyeOff, Plus, Trash2, FileText } from "lucide-react";

type EnvVar = { key: string; value: string };

type Props = {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
};

export function EnvVarInput({ value, onChange }: Props) {
  const [vars, setVars] = useState<EnvVar[]>(() => {
    const entries = Object.entries(value);
    return entries.length > 0
      ? entries.map(([key, val]) => ({ key, value: val }))
      : [{ key: "", value: "" }];
  });
  const [showValues, setShowValues] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const idPrefix = useId();

  const updateVars = (newVars: EnvVar[]) => {
    setVars(newVars);
    const record: Record<string, string> = {};
    for (const v of newVars) {
      if (v.key.trim()) {
        record[v.key.trim()] = v.value;
      }
    }
    onChange(record);
  };

  const addVar = () => {
    updateVars([...vars, { key: "", value: "" }]);
  };

  const removeVar = (index: number) => {
    const newVars = vars.filter((_, i) => i !== index);
    if (newVars.length === 0) {
      updateVars([{ key: "", value: "" }]);
    } else {
      updateVars(newVars);
    }
  };

  const updateVar = (index: number, field: keyof EnvVar, val: string) => {
    const newVars = vars.map((v, i) =>
      i === index ? { ...v, [field]: val } : v
    );
    updateVars(newVars);
  };

  const parseBulkText = () => {
    const lines = bulkText.split(/\r?\n/);
    const parsed: EnvVar[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        if (key) {
          parsed.push({ key, value });
        }
      }
    }
    if (parsed.length === 0) {
      parsed.push({ key: "", value: "" });
    }
    updateVars(parsed);
    setBulkMode(false);
    setBulkText("");
  };

  const openBulkMode = () => {
    const text = vars
      .filter((v) => v.key.trim())
      .map((v) => `${v.key}=${v.value}`)
      .join("\n");
    setBulkText(text);
    setBulkMode(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Environment Variables
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowValues(!showValues)}
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
            onClick={openBulkMode}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <FileText className="h-3.5 w-3.5" />
            Bulk
          </button>
        </div>
      </div>

      {bulkMode ? (
        <div className="space-y-2">
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`DATABASE_URL=postgres://localhost:5432/db\nPORT=3000\nDEBUG=true`}
            className="w-full h-32 rounded-sm border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-800 outline-none transition focus:border-slate-400 resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={parseBulkText}
              className="rounded-sm bg-slate-800 px-3 py-1.5 text-xs font-medium text-blue-50 transition hover:bg-slate-900"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => {
                setBulkMode(false);
                setBulkText("");
              }}
              className="rounded-sm border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {vars.map((v, i) => (
            <div key={`${idPrefix}-${i}`} className="flex items-center gap-2">
              <input
                type="text"
                value={v.key}
                onChange={(e) => updateVar(i, "key", e.target.value)}
                placeholder="KEY"
                className="flex-1 rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-400 font-mono"
              />
              <span className="text-slate-400">=</span>
              <input
                type={showValues ? "text" : "password"}
                value={v.value}
                onChange={(e) => updateVar(i, "value", e.target.value)}
                placeholder="value"
                className="flex-[2] rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-400 font-mono"
              />
              <button
                type="button"
                onClick={() => removeVar(i)}
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                disabled={vars.length === 1 && !v.key && !v.value}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addVar}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-700"
          >
            <Plus className="h-4 w-4" />
            Add variable
          </button>
        </div>
      )}
    </div>
  );
}
