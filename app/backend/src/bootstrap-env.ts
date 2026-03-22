import path from "path";
import dotenv from "dotenv";
import { applyDirectUrlToProcessEnv } from "../../config/env";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();
applyDirectUrlToProcessEnv();
