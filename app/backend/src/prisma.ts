import "./bootstrap-env";
import { PrismaClient } from "../../db/prisma-client";

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
});
