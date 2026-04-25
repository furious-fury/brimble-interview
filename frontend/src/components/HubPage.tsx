import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CreateGitForm } from "./CreateGitForm.js";
import { CreateUploadForm } from "./CreateUploadForm.js";
import { DeploymentList } from "./DeploymentList.js";
import { useToastActions } from "../hooks/useToast.js";

type Tab = "new" | "list";

export function HubPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/" });
  const [tab, setTab] = useState<Tab>("list");
  const { showSuccess } = useToastActions();

  // Show success toast when coming from delete
  useEffect(() => {
    if (search.deleted === "true") {
      showSuccess("Deployment deleted successfully", 3000);
      // Clear the search param
      void navigate({ to: "/", search: {} });
    }
  }, [search.deleted, showSuccess, navigate]);

  const goDetail = (id: string) => {
    void navigate({ to: "/deployments/$deploymentId", params: { deploymentId: id } });
  };

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Hub
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-800">
          Deployments
        </h1>
        <p className="mt-1 text-slate-500">
          Create from a Git URL or an archive, then open a deployment to watch build output.
        </p>
      </div>

      <div className="mb-8 border-b border-slate-200">
        <nav className="flex gap-1" aria-label="Hub sections">
          <button
            type="button"
            onClick={() => setTab("new")}
            className={`relative -mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === "new"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            New deployment
          </button>
          <button
            type="button"
            onClick={() => setTab("list")}
            className={`relative -mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === "list"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Your deployments
          </button>
        </nav>
      </div>

      {tab === "new" && (
        <div className="grid gap-12 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 text-sm font-medium text-slate-700">
              From Git
            </h2>
            <CreateGitForm onSuccessNavigate={goDetail} />
          </section>
          <section>
            <h2 className="mb-4 text-sm font-medium text-slate-700">
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
