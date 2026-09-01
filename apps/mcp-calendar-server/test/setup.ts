/**
 * Global test setup. Runs before any test module is imported, so the real
 * `@freeops/db/encryption` module finds a valid key the first time it
 * memoizes one.
 */
import { TEST_ENCRYPTION_KEY } from "./fakes.js";

process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;

// Deliberately NOT UTC. The production code does all interval arithmetic
// on epoch milliseconds, so a non-UTC host timezone must not change a
// single assertion — running the suite in Bogota's zone is what proves it.
process.env.TZ = "America/Bogota";
