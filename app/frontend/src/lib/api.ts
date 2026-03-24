import { getApiBaseUrl } from "./env";
import { authSession } from "./authSession";

export { getApiBaseUrl } from "./env";

/** Turns API JSON bodies (including Zod `flatten()` shapes) into a readable string. */
export function messageFromApiErrorBody(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const b = body as Record<string, unknown>;
  if (typeof b.message === "string" && b.message.trim()) return b.message;
  if (typeof b.error === "string" && b.error.trim()) return b.error;
  if (b.error && typeof b.error === "object") {
    const e = b.error as { formErrors?: unknown; fieldErrors?: Record<string, unknown> };
    const parts: string[] = [];
    if (Array.isArray(e.formErrors)) {
      for (const fe of e.formErrors) {
        if (typeof fe === "string" && fe.trim()) parts.push(fe);
      }
    }
    if (e.fieldErrors && typeof e.fieldErrors === "object") {
      for (const [k, v] of Object.entries(e.fieldErrors)) {
        if (Array.isArray(v)) {
          const msgs = v.flat().filter((x): x is string => typeof x === "string" && x.trim().length > 0);
          if (msgs.length) parts.push(`${k}: ${msgs.join(", ")}`);
        }
      }
    }
    if (parts.length) return parts.join("; ");
  }
  return "";
}

export async function apiFetch<T>(
  path: string,
  opts: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, ...rest } = opts;
  const base = getApiBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    throw new Error(
      /failed to fetch|network|load failed/i.test(msg)
        ? "Network error — check your connection and that the API is running."
        : `Request failed: ${msg}`
    );
  }
  if (res.status === 401 && token && typeof window !== "undefined") {
    try {
      authSession.onUnauthorized?.();
    } catch {
      /* ignore */
    }
    throw new Error("Session expired — sign in again.");
  }

  if (!res.ok) {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const err = await res.json().catch(() => ({}));
      const parsed = messageFromApiErrorBody(err);
      const body = err as { error?: unknown; message?: string };
      const msg =
        parsed ||
        (typeof body.message === "string" ? body.message : "") ||
        (typeof body.error === "string" ? body.error : "") ||
        res.statusText;
      throw new Error(msg);
    }
    const text = await res.text().catch(() => "");
    throw new Error(
      text ? `API ${res.status}: ${text.slice(0, 160)}` : `API error ${res.status} (${url})`
    );
  }
  return res.json() as Promise<T>;
}
