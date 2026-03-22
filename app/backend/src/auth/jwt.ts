import jwt from "jsonwebtoken";
import { loadEnv } from "../../../config/env";

export type JwtPayload = { sub: string; email: string; role: string };

export function signToken(payload: JwtPayload): string {
  const secret = loadEnv().JWT_SECRET;
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  const secret = loadEnv().JWT_SECRET;
  return jwt.verify(token, secret) as JwtPayload;
}
