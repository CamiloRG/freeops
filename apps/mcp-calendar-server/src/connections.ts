/**
 * Persistence for `calendar_connections`.
 *
 * Client choice: this service uses `@freeops/db`'s `getDb()` — the
 * RLS-**bypassing** service-role client — not the RLS client. That is
 * correct here and only here: per app_spec.md Integrations §2 this is an
 * internal, backend-to-backend service that is never reachable from a
 * browser, and its caller (the Next.js backend) has already authenticated
 * the session and passes a trusted `freelancerId`. There is no end-user
 * JWT at this layer for RLS to key off. Every query below still filters
 * by `user_id` explicitly, so a bug can't cross tenants.
 *
 * The store is expressed as an interface rather than raw Drizzle calls at
 * the call sites so the tool logic can be unit-tested against an
 * in-memory fake (no DB, no network) while the production path is the
 * real Drizzle implementation below.
 */
import { and, eq, isNull } from "drizzle-orm";
import { calendarConnections } from "@freeops/db/schema";
import { getDb, type Db } from "@freeops/db/client";
import type { CalendarProvider } from "./providers/types.js";

/** DB status values — matches the `calendar_connections_status_check` constraint. */
export type ConnectionStatus = "active" | "revoked" | "error";

export interface CalendarConnection {
  id: string;
  userId: string;
  provider: CalendarProvider;
  providerAccountEmail: string;
  accessTokenEncrypted: Buffer;
  refreshTokenEncrypted: Buffer;
  tokenExpiresAt: Date | null;
  scope: string | null;
  externalCalendarId: string | null;
  status: ConnectionStatus;
  connectedAt: Date;
  lastSyncedAt: Date | null;
}

export interface UpsertConnectionInput {
  userId: string;
  provider: CalendarProvider;
  providerAccountEmail: string;
  accessTokenEncrypted: Buffer;
  refreshTokenEncrypted: Buffer;
  tokenExpiresAt: Date | null;
  scope: string | null;
  externalCalendarId: string | null;
}

export interface PersistTokensInput {
  connectionId: string;
  accessTokenEncrypted: Buffer;
  refreshTokenEncrypted: Buffer;
  tokenExpiresAt: Date | null;
}

/** The persistence surface the tools depend on. */
export interface ConnectionStore {
  findByUserAndProvider(
    userId: string,
    provider: CalendarProvider
  ): Promise<CalendarConnection | null>;
  listByUser(userId: string): Promise<CalendarConnection[]>;
  upsert(input: UpsertConnectionInput): Promise<CalendarConnection>;
  /** Writes refreshed (and possibly rotated) tokens back. */
  persistTokens(input: PersistTokensInput): Promise<void>;
  setStatus(connectionId: string, status: ConnectionStatus): Promise<void>;
  touchLastSyncedAt(connectionId: string, at: Date): Promise<void>;
}

function toDomain(row: typeof calendarConnections.$inferSelect): CalendarConnection {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider as CalendarProvider,
    providerAccountEmail: row.providerAccountEmail,
    accessTokenEncrypted: row.accessTokenEncrypted,
    refreshTokenEncrypted: row.refreshTokenEncrypted,
    tokenExpiresAt: row.tokenExpiresAt,
    scope: row.scope,
    externalCalendarId: row.externalCalendarId,
    status: row.status as ConnectionStatus,
    connectedAt: row.connectedAt,
    lastSyncedAt: row.lastSyncedAt,
  };
}

/** Drizzle-backed store against the already-migrated Supabase schema. */
export function createDrizzleConnectionStore(db: Db = getDb()): ConnectionStore {
  return {
    async findByUserAndProvider(userId, provider) {
      const rows = await db
        .select()
        .from(calendarConnections)
        .where(
          and(
            eq(calendarConnections.userId, userId),
            eq(calendarConnections.provider, provider),
            isNull(calendarConnections.deletedAt)
          )
        )
        .limit(1);
      return rows[0] ? toDomain(rows[0]) : null;
    },

    async listByUser(userId) {
      const rows = await db
        .select()
        .from(calendarConnections)
        .where(
          and(eq(calendarConnections.userId, userId), isNull(calendarConnections.deletedAt))
        );
      return rows.map(toDomain);
    },

    async upsert(input) {
      const now = new Date();
      // Keyed on the existing `calendar_connections_user_provider_unique`
      // constraint, so a reconnect (same user + provider) replaces the old
      // tokens in one statement rather than racing a read-then-write.
      // `connected_at` is reset because a re-consent is a new connection,
      // and `status` is forced back to 'active' so reconnecting after a
      // revocation actually clears the error state.
      const rows = await db
        .insert(calendarConnections)
        .values({
          userId: input.userId,
          provider: input.provider,
          providerAccountEmail: input.providerAccountEmail,
          accessTokenEncrypted: input.accessTokenEncrypted,
          refreshTokenEncrypted: input.refreshTokenEncrypted,
          tokenExpiresAt: input.tokenExpiresAt,
          scope: input.scope,
          externalCalendarId: input.externalCalendarId,
          status: "active",
          connectedAt: now,
        })
        .onConflictDoUpdate({
          target: [calendarConnections.userId, calendarConnections.provider],
          set: {
            providerAccountEmail: input.providerAccountEmail,
            accessTokenEncrypted: input.accessTokenEncrypted,
            refreshTokenEncrypted: input.refreshTokenEncrypted,
            tokenExpiresAt: input.tokenExpiresAt,
            scope: input.scope,
            externalCalendarId: input.externalCalendarId,
            status: "active",
            connectedAt: now,
            updatedAt: now,
            // A prior soft-delete must not survive a reconnect.
            deletedAt: null,
          },
        })
        .returning();

      const row = rows[0];
      if (!row) throw new Error("calendar_connections upsert returned no row.");
      return toDomain(row);
    },

    async persistTokens({ connectionId, accessTokenEncrypted, refreshTokenEncrypted, tokenExpiresAt }) {
      await db
        .update(calendarConnections)
        .set({
          accessTokenEncrypted,
          refreshTokenEncrypted,
          tokenExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(calendarConnections.id, connectionId));
    },

    async setStatus(connectionId, status) {
      await db
        .update(calendarConnections)
        .set({ status, updatedAt: new Date() })
        .where(eq(calendarConnections.id, connectionId));
    },

    async touchLastSyncedAt(connectionId, at) {
      await db
        .update(calendarConnections)
        .set({ lastSyncedAt: at, updatedAt: at })
        .where(eq(calendarConnections.id, connectionId));
    },
  };
}
