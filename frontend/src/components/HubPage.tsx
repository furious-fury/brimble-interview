import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CreateGitForm } from "./CreateGitForm.js";
import { CreateUploadForm } from "./CreateUploadForm.js";
import { DeploymentList } from "./DeploymentList.js";

type Tab = "new" | "list";

export function HubPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("list");

  const goDetail = (id: string) => {
    void navigate({ to: "/deployments/$deploymentId", params: { deploymentId: id } });
  };

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Hub
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          Deployments
        </h1>
        <p className="mt-1 text-slate-500">
          Create from a Git URL or an archive, then open a row to watch build
          output.
        </p>
      </div>

      <div className="mb-6 border-b border-slate-200">
        <nav className="flex gap-1" aria-label="Hub sections">
          <button
            type="button"
            onClick={() => setTab("new")}
            className={`relative -mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === "new"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            New deployment
          </button>
          <button
            type="button"
            onClick={() => setTab("list")}
            className={`relative -mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === "list"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Your deployments
          </button>
        </nav>
      </div>

      {tab === "new" && (
        <div className="grid gap-10 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-800">
              From Git
            </h2>
            <CreateGitForm onSuccessNavigate={goDetail} />
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-800">
              From upload
            </h2>
            <CreateUploadForm onSuccessNavigate={goDetail} />
          </section>
        </div>
      )}

      {tab === "list" && <DeploymentList />}
    </div>
  );
}
