/**
 * Windows-friendly Prisma generate: removes cached engine folders first to avoid
 * EPERM rename errors. Client is generated under app/db/prisma/generated (not node_modules).
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const schema = path.join(root, "app", "db", "prisma", "schema.prisma");
const generated = path.join(root, "app", "db", "prisma", "generated");
const legacyNodeModulesPrisma = path.join(root, "node_modules", ".prisma");

function rmDir(p) {
  try {
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
      console.log("[prisma-generate-clean] removed", path.relative(root, p));
    }
  } catch (e) {
    console.warn("[prisma-generate-clean] could not remove", p, e.message);
  }
}

rmDir(generated);
rmDir(legacyNodeModulesPrisma);

execSync(`npx prisma generate --schema "${schema}"`, { stdio: "inherit", cwd: root, env: process.env });
