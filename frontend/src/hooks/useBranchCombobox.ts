import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchRepoBranches, queryKeys } from "@/api";
import { parseHttpsGitSource, isValidGitSource, isValidHttpUrl } from "@/lib";

interface UseBranchComboboxOptions {
  source: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Hook for managing branch selection with auto-detection from git ls-remote.
 */
export function useBranchCombobox({ source, value, onChange }: UseBranchComboboxOptions) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedSource = useMemo(() => {
    const t = source.trim();
    if (!isValidHttpUrl(t)) return t;
    const { baseUrl } = parseHttpsGitSource(t);
    return baseUrl || t;
  }, [source]);

  const branchesQuery = useQuery({
    queryKey: queryKeys.repoBranches(normalizedSource),
    queryFn: () => fetchRepoBranches(normalizedSource),
    enabled: isValidGitSource(normalizedSource),
    staleTime: 60_000,
    retry: false,
  });

  const branches = branchesQuery.data?.branches ?? [];
  const hasBranches = branches.length > 0;
  const isLoadingBranches = branchesQuery.isLoading && isValidGitSource(normalizedSource);

  // Auto-set branch from inferred URL or detected default
  useEffect(() => {
    // First priority: inferred ref from tree/blob URL
    const t = source.trim();
    if (isValidHttpUrl(t)) {
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

  const filteredBranches = useMemo(() => {
    if (!value) return branches;
    return branches.filter(b => 
      b.toLowerCase().includes(value.toLowerCase())
    );
  }, [branches, value]);

  const handleSelectBranch = (branch: string) => {
    onChange(branch);
    setDropdownOpen(false);
    inputRef.current?.focus();
  };

  return {
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
  };
}
