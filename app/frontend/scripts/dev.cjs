/**
 * Picks a free TCP port (prefers 3001, then 3002, then high ports) and runs:
 *   next dev -p <port>
 * No --hostname flag (Next.js chooses bind address).
 */
const { spawn } = require("child_process");
const { createRequire } = require("module");
const net = require("net");
const path = require("path");
const fs = require("fs");

const TRY_PORTS = [3001, 3002, 3500, 3456, 4321, 5000];
const FRONTEND_DIR = path.resolve(__dirname, "..");
const PORT_FILE = path.join(FRONTEND_DIR, ".dev-port");

function canBind(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(port);
  });
}

async function pickPort() {
  for (const p of TRY_PORTS) {
    if (await canBind(p)) return p;
  }
  process.stderr.write("[frontend] No free port in " + TRY_PORTS.join(", ") + "\n");
  process.exit(1);
}

async function main() {
  const port = await pickPort();
  try {
    fs.writeFileSync(PORT_FILE, String(port), "utf8");
  } catch {
    /* optional file */
  }
  if (port !== 3001) {
    process.stdout.write(
      `\n[frontend] Dev server port ${port} (3001/3002 busy or blocked). Open http://localhost:${port}\n` +
        `[frontend] Development CORS allows any localhost port — no .env change required.\n\n`
    );
  }

  let nextBin;
  try {
    const pkgRequire = createRequire(path.join(FRONTEND_DIR, "package.json"));
    const nextDir = path.dirname(pkgRequire.resolve("next/package.json"));
    nextBin = path.join(nextDir, "dist", "bin", "next");
  } catch {
    process.stderr.write(
      "[frontend] Could not resolve next — run `npm install` from the repo root.\n"
    );
    process.exit(1);
  }

  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(port)], {
    stdio: "inherit",
    cwd: FRONTEND_DIR,
    env: { ...process.env, PORT: String(port) },
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((e) => {
  process.stderr.write(String(e) + "\n");
  process.exit(1);
});
