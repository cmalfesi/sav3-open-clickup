import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The upstream Postgres suite is replaced by the D1 integration suites in this fork.
    exclude: ["tests/tasks.integration.test.ts"],
  },
});
