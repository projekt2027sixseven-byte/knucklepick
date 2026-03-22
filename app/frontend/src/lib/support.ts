/** Public support inbox — set `NEXT_PUBLIC_SUPPORT_EMAIL` in production. */
export function getSupportEmail(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  if (!raw) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null;
  return raw;
}
