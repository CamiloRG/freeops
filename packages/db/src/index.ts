/**
 * @freeops/db package entry point.
 *
 * `apps/web` (and later `apps/mcp-calendar-server`) import from here:
 *   import { getDb, createDb } from "@freeops/db";
 *   import { users, projects } from "@freeops/db/schema"; // or via this barrel
 */
export * from "./schema/index";
export * from "./client";
