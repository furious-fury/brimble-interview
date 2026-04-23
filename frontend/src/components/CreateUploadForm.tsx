import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { ApiError } from "../api/client.js";
import { createUploadDeployment } from "../api/deploymentsApi.js";
import { queryKeys } from "../api/queryKeys.js";
import { FileArchive } from "lucide-react";
import { EnvVarInput } from "./EnvVarInput.js";

type Props = { onSuccessNavigate?: (id: string) => void };

export function CreateUploadForm({ onSuccessNavigate }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputId = useId();

  const m = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Choose a .zip or .tar.gz / .tgz file.");
      return createUploadDeployment({
        name: name.trim(),
        file,
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
      className="flex max-w-lg flex-col gap-5"
    >
      <p className="text-sm text-slate-500">
        Upload a <code className="font-mono text-slate-600">.zip</code> or{" "}
        <code className="font-mono text-slate-600">.tar.gz</code> of your
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
          className="w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-400"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. my-app"
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
          className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed px-4 py-8 text-center text-sm transition-colors ${
            drag
              ? "border-slate-400 bg-slate-100"
              : "border-slate-200 bg-slate-50 hover:border-slate-300"
          }`}
        >
          <FileArchive
            className="h-7 w-7 text-slate-400"
            strokeWidth={1.5}
          />
          {file ? (
            <span className="font-medium text-slate-700">{file.name}</span>
          ) : (
            <span className="text-slate-500">
              Drop a file here or <span className="text-slate-700 underline">browse</span>
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
          {m.isPending ? "Uploading…" : "Upload and deploy"}
        </button>
      </div>
    </form>
  );
}
