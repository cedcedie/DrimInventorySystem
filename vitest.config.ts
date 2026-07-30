import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolves the "@/*" paths from tsconfig.json natively — no plugin needed.
  resolve: { tsconfigPaths: true },
  test: {
    // Tier A is pure logic — no DOM, no database, no network.
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The app's own .env holds live credentials; tests must never read it.
    env: {},
  },
});
