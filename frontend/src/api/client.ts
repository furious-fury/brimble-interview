import type { ApiErrorBody } from "./types.js";

const API = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseError(res: Response): Promise<never> {
  const j = (await res
    .json()
    .catch(() => ({}))) as Partial<ApiErrorBody>;
  const msg = j.error?.message ?? res.statusText;
  const code = j.error?.code ?? "UNKNOWN";
  throw new ApiError(res.status, code, msg);
}

export async function apiGetJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) await parseError(res);
  return (await res.json()) as T;
}

export async function apiPostJson<TBody extends object, TRes>(
  path: string,
  body: TBody
): Promise<TRes> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as TRes;
}

export async function apiPostFormData<TRes>(
  path: string,
  form: FormData
): Promise<TRes> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as TRes;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${API}${path}`, { method: "DELETE" });
  if (!res.ok) await parseError(res);
}

export function unwrapData<T>(res: { data: T }): T {
  return res.data;
}
