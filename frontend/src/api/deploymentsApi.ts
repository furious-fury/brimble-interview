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
}): Promise<Deployment> {
  const j = await apiPostJson<typeof input, { data: Deployment }>(
    "/deployments",
    { name: input.name, source: input.source, ref: input.ref }
  );
  return unwrapData(j);
}

export async function createUploadDeployment(input: {
  name: string;
  file: File;
}): Promise<Deployment> {
  const form = new FormData();
  form.set("name", input.name);
  form.set("file", input.file);
  const j = await apiPostFormData<{ data: Deployment }>(
    "/deployments/upload",
    form
  );
  return unwrapData(j);
}

export async function deleteDeployment(id: string): Promise<void> {
  await apiDelete(`/deployments/${id}`);
}
