import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { ApiError } from "../api/client.js";
import { createUploadDeployment } from "../api/deploymentsApi.js";
import { queryKeys } from "../api/queryKeys.js";
import { FileArchive } from "lucide-react";

type Props = { onSuccessNavigate?: (id: string) => void };

export function CreateUploadForm({ onSuccessNavigate }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputId = useId();

  const m = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Choose a .zip or .tar.gz / .tgz file.");
      return createUploadDeployment({ name: name.trim(), file });
    },
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: queryKeys.deployments() });
      setLocalError(null);
      onSuccessNavigate?.(d.id);
    },
    onError: (e: Error) => {
      setLocalError(
        e instanceof ApiError ? e.message : e.message || "Upload failed"
      );
    },
  });

  const pick = (f: File | null | undefined) => {
    if (f) setFile(f);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setLocalError(null);
        if (!name.trim()) {
          setLocalError("Name is required.");
          return;
        }
        if (!file) {
          setLocalError("Select a project archive.");
          return;
        }
        m.mutate();
      }}
      className="flex max-w-lg flex-col gap-4"
    >
      <p className="text-sm text-slate-500">
        Upload a <code className="rounded bg-slate-100 px-1">.zip</code> or{" "}
        <code className="rounded bg-slate-100 px-1">.tar.gz</code> of your
        app root (max 100MB).
      </p>
      <div>
        <label
          className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500"
          htmlFor="up-name"
        >
          Name
        </label>
        <input
          id="up-name"
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm outline-none ring-indigo-500/20 focus:ring-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
          Archive
        </p>
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files[0]);
          }}
          className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center text-sm transition-colors ${
            drag
              ? "border-indigo-400 bg-indigo-50/80"
              : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
          }`}
        >
          <FileArchive
            className="h-8 w-8 text-slate-400"
            strokeWidth={1.25}
          />
          {file ? (
            <span className="font-medium text-slate-800">{file.name}</span>
          ) : (
            <span className="text-slate-600">
              Drop a file here or <span className="text-indigo-600">browse</span>
            </span>
          )}
          <input
            id={inputId}
            type="file"
            accept=".zip,.tar.gz,.tgz,application/zip,application/gzip,application/x-gzip,application/x-tar"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
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
          {m.isPending ? "Uploading…" : "Create deployment"}
        </button>
      </div>
    </form>
  );
}
