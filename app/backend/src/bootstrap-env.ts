import path from "path";
import dotenv from "dotenv";
import { applyDirectUrlToProcessEnv } from "../../config/env";

// Monorepo: Railway/Docker cwd is usually repo root (`/app`). Local `npm run start -w` also uses root.
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "app", "backend", ".env") });
dotenv.config();
applyDirectUrlToProcessEnv();
