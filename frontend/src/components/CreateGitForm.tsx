import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../api/client.js";
import { createGitDeployment } from "../api/deploymentsApi.js";
import { queryKeys } from "../api/queryKeys.js";
import { parseHttpsGitSource } from "../lib/gitSourceNormalize.js";
import { GitBranch } from "lucide-react";

function isValidSource(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return /^https?:\/\//i.test(t) || t.startsWith("git@");
}

type Props = { onSuccessNavigate?: (id: string) => void };

export function CreateGitForm({ onSuccessNavigate }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [ref, setRef] = useState("main");
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

  const m = useMutation({
    mutationFn: () => {
      return createGitDeployment({
        name: name.trim(),
        source: source.trim(),
        ref: ref.trim() || undefined,
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
      className="flex max-w-lg flex-col gap-4"
      noValidate
    >
      <p className="text-sm text-slate-500">
        Paste a Git URL or a GitHub/GitLab <strong className="font-medium">tree</strong> link — we
        normalize the URL and set <strong className="font-medium">ref</strong> from the path when
        present. Default branch is{" "}
        <code className="rounded bg-slate-100 px-1">main</code>.
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
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm outline-none ring-indigo-500/20 transition focus:ring-2"
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
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 shadow-sm outline-none ring-indigo-500/20 transition focus:ring-2"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          onBlur={(e) => applySourceFromUrl(e.target.value)}
          placeholder="https://github.com/org/repo (or a …/tree/branch link)"
          required
        />
      </div>
      <div>
        <label
          className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500"
          htmlFor="git-ref"
        >
          <GitBranch className="h-3.5 w-3.5" />
          Ref (branch or tag)
        </label>
        <input
          id="git-ref"
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm outline-none ring-indigo-500/20 transition focus:ring-2"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
        />
      </div>
      {localError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {localError}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={m.isPending}
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {m.isPending ? "Creating…" : "Create deployment"}
        </button>
      </div>
    </form>
  );
}
