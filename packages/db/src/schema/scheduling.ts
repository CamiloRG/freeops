/**
 * Scheduling / Calendar connection — app_spec.md § "Data Model & Schema" →
 * "Scheduling / Calendar connection".
 */
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { bytea, citext, idColumn, softDelete, timestamps } from "./_helpers";
import { users } from "./identity";

// Sensitive: OAuth tokens encrypted at rest.
export const calendarConnections = pgTable(
  "calendar_connections",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // 'google' | 'microsoft'
    providerAccountEmail: text("provider_account_email").notNull(),
    accessTokenEncrypted: bytea("access_token_encrypted").notNull(),
    refreshTokenEncrypted: bytea("refresh_token_encrypted").notNull(),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    externalCalendarId: text("external_calendar_id"), // primary calendar id on the provider side
    status: text("status").notNull().default("active"), // active | revoked | error
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    unique("calendar_connections_user_provider_unique").on(table.userId, table.provider),
    check("calendar_connections_provider_check", sql`${table.provider} in ('google','microsoft')`),
    check("calendar_connections_status_check", sql`${table.status} in ('active','revoked','error')`),
  ]
);

export const bookingLinks = pgTable("booking_links", {
  id: idColumn(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(), // public URL, e.g. freeops.app/book/{slug}
  title: text("title").notNull().default("Book time with me"),
  durationMinutes: integer("duration_minutes").notNull().default(30),
  bufferMinutes: integer("buffer_minutes").notNull().default(0), // [ASSUMED DEFAULT]
  // Weekly recurring windows + timezone.
  availabilityRules: jsonb("availability_rules").notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
  ...softDelete,
});

export const bookings = pgTable(
  "bookings",
  {
    id: idColumn(),
    bookingLinkId: uuid("booking_link_id")
      .notNull()
      .references(() => bookingLinks.id, { onDelete: "restrict" }),
    // Denormalized for query convenience.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    guestName: text("guest_name").notNull(),
    guestEmail: citext("guest_email").notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("confirmed"), // confirmed | cancelled | completed | no_show
    calendarProvider: text("calendar_provider"), // 'google' | 'microsoft'
    calendarEventId: text("calendar_event_id"), // external event id created via MCP server
    notes: text("notes"),
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_bookings_user_start").on(table.userId, table.startTime),
    index("idx_bookings_link").on(table.bookingLinkId),
    check(
      "bookings_status_check",
      sql`${table.status} in ('confirmed','cancelled','completed','no_show')`
    ),
    check("bookings_calendar_provider_check", sql`${table.calendarProvider} in ('google','microsoft')`),
  ]
);
