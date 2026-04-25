import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { GitBranch, Loader2, ChevronDown } from "lucide-react";
import { fetchRepoBranches } from "../api/reposApi.js";
import { queryKeys } from "../api/queryKeys.js";
import { parseHttpsGitSource } from "../lib/gitSourceNormalize.js";

function isValidSource(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return /^https?:\/\//i.test(t) || t.startsWith("git@");
}

interface BranchComboboxProps {
  source: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Branch selector with auto-detection from git ls-remote.
 * Supports manual entry, dropdown selection, and branch filtering.
 */
export function BranchCombobox({ source, value, onChange }: BranchComboboxProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedSource = useMemo(() => {
    const t = source.trim();
    if (!/^https?:\/\//i.test(t)) return t;
    const { baseUrl } = parseHttpsGitSource(t);
    return baseUrl || t;
  }, [source]);

  const branchesQuery = useQuery({
    queryKey: queryKeys.repoBranches(normalizedSource),
    queryFn: () => fetchRepoBranches(normalizedSource),
    enabled: isValidSource(normalizedSource),
    staleTime: 60_000,
    retry: false,
  });

  const branches = branchesQuery.data?.branches ?? [];
  const hasBranches = branches.length > 0;
  const isLoadingBranches = branchesQuery.isLoading && isValidSource(normalizedSource);

  // Auto-set branch from inferred URL or detected default
  useEffect(() => {
    // First priority: inferred ref from tree/blob URL
    const t = source.trim();
    if (/^https?:\/\//i.test(t)) {
      const { inferredRef } = parseHttpsGitSource(t);
      if (inferredRef) {
        onChange(inferredRef);
        return;
      }
    }

    // Second priority: detected default branch from git ls-remote
    if (branchesQuery.data?.defaultBranch) {
      onChange(branchesQuery.data.defaultBranch);
      return;
    }

    // Third priority: if branches exist but no default detected, use first
    if (branches.length) {
      onChange(branches[0]);
      return;
    }

    // Keep current value or default to main
    if (!value) {
      onChange("main");
    }
  }, [source, branchesQuery.data, branches.length, onChange, value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelectBranch = (branch: string) => {
    onChange(branch);
    setDropdownOpen(false);
    inputRef.current?.focus();
  };

  // Filter branches based on current input
  const filteredBranches = useMemo(() => {
    if (!value) return branches;
    return branches.filter(b => 
      b.toLowerCase().includes(value.toLowerCase())
    );
  }, [branches, value]);

  return (
    <div className="relative" ref={dropdownRef}>
      <label
        className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500"
        htmlFor="git-ref"
      >
        <GitBranch className="h-3.5 w-3.5" />
        Branch
        {isLoadingBranches && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
        )}
      </label>
      
      <div className="relative">
        <input
          ref={inputRef}
          id="git-ref"
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

      {dropdownOpen && hasBranches && (
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
              onClick={() => handleSelectBranch(b)}
              className={`flex w-full items-center px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                b === value ? "bg-slate-50 font-medium text-slate-900" : "text-slate-700"
              }`}
            >
              {b}
              {b === branchesQuery.data?.defaultBranch && (
                <span className="ml-2 text-xs text-slate-400">
                  default
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {branchesQuery.isError && (
        <p className="mt-1 text-xs text-slate-400">
          Could not list branches — type any branch or tag manually.
        </p>
      )}
    </div>
  );
}
