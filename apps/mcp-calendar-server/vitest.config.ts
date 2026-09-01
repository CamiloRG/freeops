import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Sets a deterministic ENCRYPTION_KEY before any test touches the real
    // encryption module, and pins TZ so a developer's local timezone can't
    // change a result (the code is UTC-only by construction; the pin is
    // there so a regression that reintroduces local-time math fails on
    // every machine, not just on machines outside UTC).
    setupFiles: ["./test/setup.ts"],
  },
});
