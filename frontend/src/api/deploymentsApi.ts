import { apiDelete, apiGetJson, apiPostFormData, apiPostJson, unwrapData } from "./client.js";
import type { Deployment } from "./types.js";

export async function listDeployments(
  limit = 100
): Promise<Deployment[]> {
  const j = await apiGetJson<{ data: Deployment[] }>(
    `/deployments?limit=${encodeURIComponent(String(limit))}`
  );
  return unwrapData(j);
}

export async function getDeployment(id: string): Promise<Deployment> {
  const j = await apiGetJson<{ data: Deployment }>(`/deployments/${id}`);
  return unwrapData(j);
}

export async function createGitDeployment(input: {
  name: string;
  source: string;
  ref?: string;
  envVars?: Record<string, string>;
}): Promise<Deployment> {
  const j = await apiPostJson<typeof input, { data: Deployment }>(
    "/deployments",
    { name: input.name, source: input.source, ref: input.ref, envVars: input.envVars }
  );
  return unwrapData(j);
}

export async function createUploadDeployment(input: {
  name: string;
  file: File;
  envVars?: Record<string, string>;
}): Promise<Deployment> {
  const form = new FormData();
  form.set("name", input.name);
  form.set("file", input.file);
  if (input.envVars) {
    form.set("envVars", JSON.stringify(input.envVars));
  }
  const j = await apiPostFormData<{ data: Deployment }>(
    "/deployments/upload",
    form
  );
  return unwrapData(j);
}

export async function deleteDeployment(id: string): Promise<void> {
  await apiDelete(`/deployments/${id}`);
}

export async function redeployDeployment(
  id: string,
  envVars?: Record<string, string>
): Promise<Deployment> {
  const j = await apiPostJson<{ envVars?: Record<string, string> }, { data: Deployment }>(
    `/deployments/${id}/redeploy`,
    { envVars }
  );
  return unwrapData(j);
}
