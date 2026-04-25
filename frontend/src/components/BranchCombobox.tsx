import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { useBranchCombobox } from "@/hooks";
import { BranchDropdown, BranchLabel } from "@/components";

interface BranchComboboxProps {
  source: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Branch selector with auto-detection from git ls-remote.
 * Supports manual entry, dropdown selection, and branch filtering.
 * Refactored to use composable hook and sub-components.
 */
export function BranchCombobox({ source, value, onChange }: BranchComboboxProps) {
  const {
    dropdownOpen,
    setDropdownOpen,
    dropdownRef,
    inputRef,
    branchesQuery,
    branches,
    filteredBranches,
    hasBranches,
    isLoadingBranches,
    handleSelectBranch,
  } = useBranchCombobox({ source, value, onChange });

  const inputId = useId();

  return (
    <div className="relative" ref={dropdownRef}>
      <BranchLabel isLoading={isLoadingBranches} inputId={inputId} />
      
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          className="w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-400"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (hasBranches) setDropdownOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && hasBranches) {
              e.preventDefault();
              setDropdownOpen(true);
            }
            if (e.key === "Escape") {
              setDropdownOpen(false);
            }
          }}
          placeholder="main"
        />

        {hasBranches && (
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            tabIndex={-1}
          >
            <ChevronDown className={`h-4 w-4 transition ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      <BranchDropdown
        branches={branches}
        filteredBranches={filteredBranches}
        selectedValue={value}
        defaultBranch={branchesQuery.data?.defaultBranch ?? null}
        isOpen={dropdownOpen}
        onSelect={handleSelectBranch}
      />

      {branchesQuery.isError && (
        <p className="mt-1 text-xs text-slate-400">
          Could not list branches — type any branch or tag manually.
        </p>
      )}
    </div>
  );
}
