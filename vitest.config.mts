import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolve the `@/*` alias from tsconfig.json (built into Vite 8).
    tsconfigPaths: true,
  },
  test: {
    // Pure TypeScript for now; switch per file to jsdom once UI tests exist.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
