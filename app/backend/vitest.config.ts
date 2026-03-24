import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    setupFiles: ["./src/test/setup.ts"],
    /** Integration tests share DB fixtures and user state — run one at a time. */
    maxConcurrency: 1,
  },
});
