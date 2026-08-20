/**
 * Barrel re-export of every domain schema file, mirroring app_spec.md's
 * "Data Model & Schema" § "Schema by domain" breakdown. This is the
 * object passed to `drizzle()` and to `drizzle-kit` for
 * generate/migrate/push/studio.
 */
export * from "./identity";
export * from "./profile";
export * from "./branding";
export * from "./scheduling";
export * from "./business";
export * from "./crm";
export * from "./finance";
export * from "./compliance";
export * from "./billing";
export * from "./audit";
