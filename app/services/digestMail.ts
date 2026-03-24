import { loadEnv } from "../config/env";

export type DigestEmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type DigestSendResult = { ok: true } | { ok: false; error: string };

/**
 * Provider-ready digest delivery. Uses Resend HTTP API when RESEND_API_KEY + DIGEST_FROM_EMAIL are set.
 */
export async function sendDigestEmail(payload: DigestEmailPayload): Promise<DigestSendResult> {
  const env = loadEnv();
  const key = env.RESEND_API_KEY?.trim();
  const from = env.DIGEST_FROM_EMAIL?.trim();
  if (!key || !from) {
    return { ok: false, error: "digest_mail_not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: t.slice(0, 800) || `resend_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function digestMailConfigured(): boolean {
  try {
    const env = loadEnv();
    return Boolean(env.RESEND_API_KEY?.trim() && env.DIGEST_FROM_EMAIL?.trim());
  } catch {
    return false;
  }
}

export function renderDigestEmailHtml(fixtures: { headline: string; kickoff: string; home: string; away: string }[]): {
  html: string;
  text: string;
  subject: string;
} {
  const subject = `Knuckle morning digest · ${fixtures.length} fixture${fixtures.length === 1 ? "" : "s"}`;
  const rows = fixtures
    .slice(0, 25)
    .map(
      (f) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(f.kickoff)}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(f.home)} vs ${escapeHtml(f.away)}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(f.headline)}</td></tr>`
    )
    .join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:system-ui,sans-serif;color:#111">
  <h2 style="margin:0 0 12px">Morning digest</h2>
  <p style="color:#555;font-size:14px">Top signals from your Knuckle schedule window.</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px"><thead><tr><th align="left">Kickoff</th><th align="left">Fixture</th><th align="left">Signal</th></tr></thead><tbody>${rows}</tbody></table>
  <p style="margin-top:20px;font-size:12px;color:#888">Research &amp; entertainment only — not financial advice.</p>
  </body></html>`;
  const text = fixtures
    .map((f) => `${f.kickoff}\t${f.home} vs ${f.away}\t${f.headline}`)
    .join("\n");
  return { html, text, subject };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
