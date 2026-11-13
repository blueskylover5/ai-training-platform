import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    passWithNoTests: true,
    // Each database test file starts its own in-memory Postgres (PGlite). Running them side by
    // side can run out of memory on small machines, so test files run one at a time.
    fileParallelism: false,
  },
});
