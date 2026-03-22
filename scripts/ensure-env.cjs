/**
 * Ensures root .env exists for local dev (copies from .env.example once)
 * and patches legacy .env files missing Prisma-required fields.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

if (!fs.existsSync(envPath)) {
  if (!fs.existsSync(examplePath)) {
    console.error("[ensure-env] Missing .env and .env.example");
    process.exit(1);
  }
  fs.copyFileSync(examplePath, envPath);
  console.log("[ensure-env] Created .env from .env.example — review secrets before production.");
}

/** Prisma schema uses `directUrl = env("DIRECT_URL")` — mirror DATABASE_URL when unset. */
function ensureDirectUrl() {
  if (!fs.existsSync(envPath)) return;
  let txt = fs.readFileSync(envPath, "utf8");
  if (/^DIRECT_URL\s*=/m.test(txt)) return;
  const match = txt.match(/^DATABASE_URL\s*=\s*(.*)$/m);
  if (!match) {
    console.warn("[ensure-env] DATABASE_URL not found; add DIRECT_URL manually for Prisma.");
    return;
  }
  let val = match[1].trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  const line = `DIRECT_URL=${JSON.stringify(val)}`;
  fs.appendFileSync(envPath, (txt.endsWith("\n") ? "" : "\n") + line + "\n", "utf8");
  console.log("[ensure-env] Added DIRECT_URL (mirrors DATABASE_URL) for Prisma.");
}

ensureDirectUrl();

const feDir = path.join(root, "app", "frontend");
const feLocal = path.join(feDir, ".env.local");
const feExample = path.join(feDir, ".env.example");
if (!fs.existsSync(feLocal) && fs.existsSync(feExample)) {
  let txt = fs.readFileSync(feExample, "utf8");
  txt = txt.replace(/127\.0\.0\.1/g, "localhost");
  fs.writeFileSync(feLocal, txt, "utf8");
  console.log("[ensure-env] Created app/frontend/.env.local from .env.example");
}
