import { getPublicEnv } from "./env";

function apiBase(): string {
  return getPublicEnv().NEXT_PUBLIC_API_URL;
}

export async function apiFetch<T>(
  path: string,
  opts: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, ...rest } = opts;
  const res = await fetch(`${apiBase()}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export function getApiBaseUrl(): string {
  return apiBase();
}
