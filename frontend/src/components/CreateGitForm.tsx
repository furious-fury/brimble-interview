import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ApiError } from "../api/client.js";
import { createGitDeployment } from "../api/deploymentsApi.js";
import { queryKeys } from "../api/queryKeys.js";
import { parseHttpsGitSource } from "../lib/gitSourceNormalize.js";
import { BranchCombobox } from "./BranchCombobox.js";
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

/**
 * Git deployment creation form with branch auto-detection and env vars.
 * Refactored to use composable sub-components.
 */
export function CreateGitForm({ onSuccessNavigate }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [ref, setRef] = useState("main");
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);

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

      <BranchCombobox 
        source={source} 
        value={ref} 
        onChange={setRef} 
      />

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
