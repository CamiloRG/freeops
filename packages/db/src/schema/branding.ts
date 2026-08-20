/**
 * Branding & Resume/CV — app_spec.md § "Data Model & Schema" → "Branding &
 * Resume/CV".
 */
import { check, date, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, softDelete, timestamps } from "./_helpers";
import { users } from "./identity";
import { projects } from "./business";

export const brandingAssets = pgTable("branding_assets", {
  id: idColumn(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  logoFileKey: text("logo_file_key"),
  primaryColor: text("primary_color"), // hex
  secondaryColor: text("secondary_color"),
  ...timestamps,
  ...softDelete,
});

export const resumes = pgTable("resumes", {
  id: idColumn(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  headline: text("headline"),
  summary: text("summary"),
  templateId: text("template_id").default("default"), // [ASSUMED DEFAULT] single built-in template for v1
  ...timestamps,
  ...softDelete,
});

export const resumeEntries = pgTable(
  "resume_entries",
  {
    id: idColumn(),
    resumeId: uuid("resume_id")
      .notNull()
      .references(() => resumes.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("manual"), // 'manual' | 'project'
    // Populated when source='project'; pulls latest completed projects.
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    clientName: text("client_name"),
    description: text("description"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    displayOrder: integer("display_order").notNull().default(0),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index("idx_resume_entries_resume").on(table.resumeId, table.displayOrder),
    check("resume_entries_source_check", sql`${table.source} in ('manual','project')`),
  ]
);

export const resumeSkills = pgTable("resume_skills", {
  id: idColumn(),
  resumeId: uuid("resume_id")
    .notNull()
    .references(() => resumes.id, { onDelete: "cascade" }),
  skillName: text("skill_name").notNull(),
  createdAt: timestamps.createdAt,
});
