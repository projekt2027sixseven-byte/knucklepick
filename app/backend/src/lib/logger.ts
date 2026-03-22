import { loadEnv } from "../../../config/env";

type LogLevel = "debug" | "info" | "warn" | "error";

function basePayload(level: LogLevel, msg: string, extra?: Record<string, unknown>) {
  const env = (() => {
    try {
      return loadEnv().NODE_ENV;
    } catch {
      return process.env.NODE_ENV ?? "development";
    }
  })();
  return {
    ts: new Date().toISOString(),
    level,
    service: "match-oracle-backend",
    env,
    msg,
    ...extra,
  };
}

export const log = {
  debug(msg: string, extra?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === "production") return;
    console.debug(JSON.stringify(basePayload("debug", msg, extra)));
  },
  info(msg: string, extra?: Record<string, unknown>): void {
    console.log(JSON.stringify(basePayload("info", msg, extra)));
  },
  warn(msg: string, extra?: Record<string, unknown>): void {
    console.warn(JSON.stringify(basePayload("warn", msg, extra)));
  },
  error(msg: string, extra?: Record<string, unknown>): void {
    console.error(JSON.stringify(basePayload("error", msg, extra)));
  },
};
