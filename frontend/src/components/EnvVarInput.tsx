import { Plus } from "lucide-react";
import { useEnvVars } from "@/hooks";
import { EnvVarRow, BulkEnvVarInput, EnvVarControls } from "@/components";

type Props = {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
};

/**
 * Environment variable input with individual key-value pairs or bulk text mode.
 * Refactored to use composable hook and sub-components.
 */
export function EnvVarInput({ value, onChange }: Props) {
  const {
    vars,
    showValues,
    setShowValues,
    bulkMode,
    bulkText,
    setBulkText,
    idPrefix,
    addVar,
    removeVar,
    updateVar,
    parseBulkText,
    openBulkMode,
    closeBulkMode,
  } = useEnvVars(value);

  return (
    <div className="space-y-3">
      <EnvVarControls
        showValues={showValues}
        onToggleShow={() => setShowValues(!showValues)}
        onBulkClick={openBulkMode}
      />

      {bulkMode ? (
        <BulkEnvVarInput
          value={bulkText}
          onChange={setBulkText}
          onApply={() => parseBulkText(bulkText, onChange)}
          onCancel={closeBulkMode}
        />
      ) : (
        <div className="space-y-2">
          {vars.map((v, i) => (
            <EnvVarRow
              key={`${idPrefix}-${i}`}
              keyValue={v.key}
              value={v.value}
              showValues={showValues}
              canRemove={!(vars.length === 1 && !v.key && !v.value)}
              onKeyChange={(val) => updateVar(i, "key", val, onChange)}
              onValueChange={(val) => updateVar(i, "value", val, onChange)}
              onRemove={() => removeVar(i, onChange)}
            />
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
