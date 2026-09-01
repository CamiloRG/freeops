/**
 * @freeops/db package entry point.
 *
 * `apps/web` and `apps/mcp-calendar-server` import from here:
 *   import { getDb, createDb } from "@freeops/db";
 *   import { users, projects } from "@freeops/db/schema"; // or via this barrel
 *   import { encryptField } from "@freeops/db/encryption"; // or via this barrel
 */
export * from "./schema/index";
export * from "./client";
export * from "./encryption";
