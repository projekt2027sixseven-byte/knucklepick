/**
 * Quick smoke check: backend health + readiness (optional).
 * Usage: node scripts/smoke-test.cjs [baseUrl]
 * Default: http://127.0.0.1:4000
 */
const base = (process.argv[2] || "http://127.0.0.1:4000").replace(/\/$/, "");

async function get(path) {
  const res = await fetch(`${base}${path}`, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  const health = await get("/api/health");
  console.log("GET /api/health", health.status, health.json);
  if (!health.ok) process.exit(1);

  const ready = await get("/api/ready");
  console.log("GET /api/ready", ready.status, ready.json);
  if (!ready.ok) process.exit(1);

  const meta = await get("/api/meta/leagues");
  console.log("GET /api/meta/leagues", meta.status, Array.isArray(meta.json?.leagues) ? `${meta.json.leagues.length} leagues` : meta.json);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
