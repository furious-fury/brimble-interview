interface BranchDropdownProps {
  branches: string[];
  filteredBranches: string[];
  selectedValue: string;
  defaultBranch: string | null;
  isOpen: boolean;
  onSelect: (branch: string) => void;
}

/**
 * Dropdown for selecting branches with filtering and default indicator.
 */
export function BranchDropdown({
  branches,
  filteredBranches,
  selectedValue,
  defaultBranch,
  isOpen,
  onSelect,
}: BranchDropdownProps) {
  if (!isOpen || branches.length === 0) return null;

  return (
    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-sm border border-slate-200 bg-white py-1">
      {filteredBranches.length === 0 && (
        <div className="px-3 py-2 text-sm text-slate-400">
          No matching branches
        </div>
      )}
      {filteredBranches.map((b) => (
        <button
          key={b}
          type="button"
          onClick={() => onSelect(b)}
          className={`flex w-full items-center px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
            b === selectedValue ? "bg-slate-50 font-medium text-slate-900" : "text-slate-700"
          }`}
        >
          {b}
          {b === defaultBranch && (
            <span className="ml-2 text-xs text-slate-400">
              default
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
