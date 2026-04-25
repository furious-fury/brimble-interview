import { useState, useId } from "react";

type EnvVar = { key: string; value: string };

/**
 * Hook for managing environment variable state.
 * Handles individual pairs and bulk text operations.
 */
export function useEnvVars(initialValue: Record<string, string>) {
  const [vars, setVars] = useState<EnvVar[]>(() => {
    const entries = Object.entries(initialValue);
    return entries.length > 0
      ? entries.map(([key, val]) => ({ key, value: val }))
      : [{ key: "", value: "" }];
  });
  const [showValues, setShowValues] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const idPrefix = useId();

  const buildRecord = (vars: EnvVar[]): Record<string, string> => {
    const record: Record<string, string> = {};
    for (const v of vars) {
      if (v.key.trim()) {
        record[v.key.trim()] = v.value;
      }
    }
    return record;
  };

  const addVar = () => {
    setVars((prev) => [...prev, { key: "", value: "" }]);
  };

  const removeVar = (index: number, onChange?: (record: Record<string, string>) => void) => {
    setVars((prev) => {
      const newVars = prev.filter((_, i) => i !== index);
      const finalVars = newVars.length === 0 ? [{ key: "", value: "" }] : newVars;
      onChange?.(buildRecord(finalVars));
      return finalVars;
    });
  };

  const updateVar = (
    index: number,
    field: keyof EnvVar,
    val: string,
    onChange?: (record: Record<string, string>) => void
  ) => {
    setVars((prev) => {
      const newVars = prev.map((v, i) =>
        i === index ? { ...v, [field]: val } : v
      );
      onChange?.(buildRecord(newVars));
      return newVars;
    });
  };

  const parseBulkText = (text: string, onChange?: (record: Record<string, string>) => void) => {
    const lines = text.split(/\r?\n/);
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
    const newVars = parsed;
    setVars(newVars);
    onChange?.(buildRecord(newVars));
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

  const closeBulkMode = () => {
    setBulkMode(false);
    setBulkText("");
  };

  return {
    vars,
    showValues,
    setShowValues,
    bulkMode,
    setBulkMode,
    bulkText,
    setBulkText,
    idPrefix,
    addVar,
    removeVar,
    updateVar,
    parseBulkText,
    openBulkMode,
    closeBulkMode,
  };
}
