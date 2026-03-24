import { NextResponse } from "next/server";

/**
 * Same-origin `/api/health` for ops and monitoring.
 * When `BACKEND_PROXY_URL` is set, proxies to the Express API; otherwise returns 503 with a clear hint
 * (Next has no other handler for `/api/*` unless rewrites apply — rewrites skip paths that match a file).
 */
export async function GET() {
  const backend = process.env.BACKEND_PROXY_URL?.trim().replace(/\/$/, "");
  if (backend) {
    try {
      const r = await fetch(`${backend}/api/health`, { cache: "no-store" });
      const body = await r.text();
      return new NextResponse(body, {
        status: r.status,
        headers: {
          "content-type": r.headers.get("content-type") || "application/json",
        },
      });
    } catch {
      return NextResponse.json({ ok: false, error: "upstream_unreachable" }, { status: 502 });
    }
  }

  return NextResponse.json(
    {
      ok: false,
      message:
        "Backend not configured: set BACKEND_PROXY_URL on Vercel (recommended) or use NEXT_PUBLIC_API_URL for direct API calls.",
    },
    { status: 503 }
  );
}
