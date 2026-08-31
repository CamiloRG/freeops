import path from "node:path";
import { defineConfig } from "vitest/config";

/** Minimal vitest config for `apps/web` service-layer unit tests — same `@/` alias `tsconfig.json` declares. */
export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
