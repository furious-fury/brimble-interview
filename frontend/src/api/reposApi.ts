import { apiGetJson, unwrapData } from "./client.js";

export interface RepoBranchesResult {
  defaultBranch: string | null;
  branches: string[];
}

export async function fetchRepoBranches(url: string): Promise<RepoBranchesResult> {
  const j = await apiGetJson<{ data: RepoBranchesResult }>(
    `/repos/branches?url=${encodeURIComponent(url)}`
  );
  return unwrapData(j);
}
