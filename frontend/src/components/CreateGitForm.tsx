import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../api/client.js";
import { createGitDeployment } from "../api/deploymentsApi.js";
import { fetchRepoBranches } from "../api/reposApi.js";
import { queryKeys } from "../api/queryKeys.js";
import { parseHttpsGitSource } from "../lib/gitSourceNormalize.js";
import { GitBranch, Loader2, ChevronDown } from "lucide-react";
import { EnvVarInput } from "./EnvVarInput.js";

function isValidSource(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return /^https?:\/\//i.test(t) || t.startsWith("git@");
}

function debounce<T extends (...args: string[]) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

type Props = { onSuccessNavigate?: (id: string) => void };

export function CreateGitForm({ onSuccessNavigate }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [ref, setRef] = useState("main");
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
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

  // Auto-set ref from inferred URL or detected default branch
  useEffect(() => {
    // First priority: inferred ref from tree/blob URL
    const t = source.trim();
    if (/^https?:\/\//i.test(t)) {
      const { inferredRef } = parseHttpsGitSource(t);
      if (inferredRef) {
        setRef(inferredRef);
        return;
      }
    }

    // Second priority: detected default branch from git ls-remote
    if (branchesQuery.data?.defaultBranch) {
      setRef(branchesQuery.data.defaultBranch);
      return;
    }

    // Third priority: if branches exist but no default detected, use first
    if (branches.length) {
      setRef(branches[0]);
      return;
    }

    // Keep current value or default to main
    if (!ref) {
      setRef("main");
    }
  }, [source, branchesQuery.data, branches.length, ref]);

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

  const applySourceFromUrl = (raw: string) => {
    const t = raw.trim();
    if (!/^https?:\/\//i.test(t)) {
      return;
    }
    const { baseUrl, inferredRef } = parseHttpsGitSource(t);
    if (baseUrl) {
      setSource(baseUrl);
    }
    if (inferredRef) {
      setRef(inferredRef);
    }
  };

  const debouncedBlur = useMemo(() => debounce(applySourceFromUrl, 300), []);

  const m = useMutation({
    mutationFn: () => {
      return createGitDeployment({
        name: name.trim(),
        source: source.trim(),
        ref: ref.trim() || undefined,
        envVars: Object.keys(envVars).length > 0 ? envVars : undefined,
      });
    },
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: queryKeys.deployments() });
      setLocalError(null);
      onSuccessNavigate?.(d.id);
    },
    onError: (e: Error) => {
      setLocalError(
        e instanceof ApiError ? e.message : e.message || "Request failed"
      );
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!name.trim()) {
      setLocalError("Name is required.");
      return;
    }
    if (!isValidSource(source)) {
      setLocalError("Source must be an http(s) or git@ URL.");
      return;
    }
    m.mutate();
  };

  const handleSelectBranch = (branch: string) => {
    setRef(branch);
    setDropdownOpen(false);
    inputRef.current?.focus();
  };

  // Filter branches based on current input
  const filteredBranches = useMemo(() => {
    if (!ref) return branches;
    return branches.filter(b => 
      b.toLowerCase().includes(ref.toLowerCase())
    );
  }, [branches, ref]);

  return (
    <form
      onSubmit={submit}
      className="flex max-w-lg flex-col gap-5"
      noValidate
    >
      <p className="text-sm text-slate-500">
        Paste a Git URL or a GitHub/GitLab tree link — we normalize the URL and 
        detect the default branch automatically.
      </p>
      
      <div>
        <label
          className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500"
          htmlFor="git-name"
        >
          Name
        </label>
        <input
          id="git-name"
          className="w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-400"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. my-hello-app"
          required
        />
      </div>

      <div>
        <label
          className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500"
          htmlFor="git-source"
        >
          Git URL
        </label>
        <input
          id="git-source"
          className="w-full rounded-sm border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-800 outline-none transition focus:border-slate-400"
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            debouncedBlur(e.target.value);
          }}
          onBlur={(e) => applySourceFromUrl(e.target.value)}
          placeholder="https://github.com/org/repo"
          required
        />
      </div>

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
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            onFocus={() => {
              setInputFocused(true);
              if (hasBranches) setDropdownOpen(true);
            }}
            onBlur={() => {
              setInputFocused(false);
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
                  b === ref ? "bg-slate-50 font-medium text-slate-900" : "text-slate-700"
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

      <EnvVarInput value={envVars} onChange={setEnvVars} />

      {localError && (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {localError}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={m.isPending}
          className="inline-flex items-center justify-center rounded-sm bg-slate-800 px-4 py-2 text-sm font-medium text-blue-50 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {m.isPending ? "Deploying…" : "Deploy"}
        </button>
      </div>
    </form>
  );
}
