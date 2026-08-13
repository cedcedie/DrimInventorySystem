import { ApiError } from "@/lib/api";

async function throwApiError(res: Response): Promise<never> {
  const data = await res.json().catch(() => ({ error: "Request failed" }));
  throw new ApiError(data.error ?? `Request failed: ${res.status}`, res.status);
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return throwApiError(res);
  return res.json() as Promise<T>;
}

export async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return throwApiError(res);
  return res.json() as Promise<T>;
}

export async function deleteJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) return throwApiError(res);
  return res.json() as Promise<T>;
}
