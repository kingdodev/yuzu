import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    environment: "node",
    // Elke testbestand start een eigen Postgres in het geheugen (PGlite).
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
