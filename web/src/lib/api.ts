const BASE = "/api/v1";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const apiGet = <T>(path: string) => request<T>("GET", path);
export const apiSend = <T>(method: string, path: string, body?: unknown) => request<T>(method, path, body);

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };
