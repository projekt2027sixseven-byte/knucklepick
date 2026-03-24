/** Set by `AuthSessionBridge` — `apiFetch` invokes on HTTP 401 to avoid broken authed state. */
export const authSession: { onUnauthorized: (() => void) | null } = {
  onUnauthorized: null,
};
