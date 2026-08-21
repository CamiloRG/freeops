/**
 * Request-scoped, RLS-aware Drizzle client — Phase 4's foundational piece.
 *
 * Background (see ADR "RLS is proven at the Postgres/PostgREST layer, not
 * yet wired into the app's own Drizzle runtime path"): `packages/db`'s
 * `getDb()` (see `client.ts`) connects via `DATABASE_URL` as a single fixed
 * Postgres role and never forwards the caller's Supabase JWT, so
 * `auth.uid()` inside RLS policies resolves to `null` for every query
 * issued through it — RLS is real at the database level but inert against
 * that client. `getDb()` remains correct for admin/background-job use
 * (bypasses RLS on purpose) but MUST NOT be used for user-scoped product
 * reads/writes going forward.
 *
 * This module is the fix: `withRlsContext(accessToken, callback)` runs
 * `callback` inside a single Postgres transaction that first impersonates
 * the calling user exactly the way PostgREST/supabase-js would, so RLS
 * policies see the real `auth.uid()` / `auth.role()`:
 *   1. `select set_config('request.jwt.claims', <decoded JWT payload>, true)`
 *   2. `select set_config('request.jwt.claim.sub', <sub claim>, true)`
 *   3. `set local role authenticated`
 * All three are transaction-local (`true` = is_local / `set local`), so
 * they never leak onto another request sharing the same pooled connection
 * once the transaction ends — required for correctness against Supabase's
 * transaction-mode pooler (PgBouncer may hand different statements in the
 * same logical request to different backend connections, but everything
 * inside one `db.transaction()` block stays pinned to one connection for
 * its duration).
 *
 * This mirrors Drizzle's own documented RLS pattern
 * (https://orm.drizzle.team/docs/rls) and the community reference
 * implementation at https://github.com/rphlmr/drizzle-supabase-rls —
 * confirmed approach, not re-derived from scratch.
 *
 * Usage (every Server Action / Route Handler touching user-owned data):
 *   import { withRlsContext } from "@freeops/db/rls-client";
 *   const profile = await withRlsContext(accessToken, (tx) =>
 *     tx.query.freelancerProfiles.findFirst({ where: eq(freelancerProfiles.userId, userId) })
 *   );
 * `apps/web/src/lib/db/rls.ts` wraps this with the Supabase session lookup
 * so call sites don't have to plumb the access token by hand.
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

export type RlsTx = Parameters<Parameters<ReturnType<typeof drizzle<typeof schema>>["transaction"]>[0]>[0];

interface JwtClaims {
  sub: string;
  role?: string;
  [key: string]: unknown;
}

declare global {
  // eslint-disable-next-line no-var
  var __freeopsRlsSql: ReturnType<typeof postgres> | undefined;
}

/**
 * Shared postgres.js connection pool used only by the RLS path, kept
 * separate from `client.ts`'s admin pool so the two connection lifecycles
 * (and their very different trust levels) never get confused. Cached on
 * `globalThis` for the same dev-hot-reload reason as `getDb()`.
 */
function getRlsSql() {
  if (globalThis.__freeopsRlsSql) {
    return globalThis.__freeopsRlsSql;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set — required for the RLS-aware Drizzle client (packages/db/src/rls-client.ts)."
    );
  }
  const client = postgres(connectionString, {
    prepare: false, // required for Supabase's transaction-mode pooler, same as client.ts
    max: 10,
    idle_timeout: 30,
  });
  if (process.env.NODE_ENV !== "production") {
    globalThis.__freeopsRlsSql = client;
  }
  return client;
}

/**
 * Decodes a JWT's payload segment without verifying its signature.
 * Signature verification already happened upstream — the access token
 * passed in here must only ever come from a token Supabase itself has
 * just validated (e.g. `apps/web/src/lib/db/rls.ts` only calls this after
 * `supabase.auth.getUser()` succeeds, which round-trips to Supabase's Auth
 * server). This function's only job is extracting `sub`/`role` claims to
 * hand to Postgres via `set_config` — never use it as an auth check on its
 * own.
 */
function decodeJwtPayload(accessToken: string): JwtClaims {
  const parts = accessToken.split(".");
  if (parts.length !== 3) {
    throw new Error("withRlsContext: malformed JWT access token (expected 3 dot-separated segments).");
  }
  const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
  const claims = JSON.parse(payloadJson) as JwtClaims;
  if (!claims.sub) {
    throw new Error("withRlsContext: JWT payload has no `sub` claim.");
  }
  return claims;
}

/**
 * Runs `callback` with a Drizzle instance scoped to one Postgres
 * transaction where RLS policies resolve `auth.uid()`/`auth.role()`
 * exactly as they would for the same user's request through
 * PostgREST/supabase-js. See module doc comment above for the mechanism.
 *
 * Every Server Action / Route Handler that reads or writes user-owned data
 * MUST go through this (or `apps/web/src/lib/db/rls.ts`'s convenience
 * wrapper), never `getDb()`.
 */
export async function withRlsContext<T>(
  accessToken: string,
  callback: (tx: RlsTx) => Promise<T>
): Promise<T> {
  const claims = decodeJwtPayload(accessToken);
  const role = claims.role ?? "authenticated";
  // Defense in depth: `role` is a trusted Supabase claim by construction
  // (this token was already validated via `supabase.auth.getUser()`
  // upstream), but `set local role` can't be parameterized like a normal
  // value, so guard against interpolating anything but a bare Postgres
  // identifier before it reaches `sql.raw`.
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(role)) {
    throw new Error(`withRlsContext: refusing to SET LOCAL ROLE to unexpected value "${role}".`);
  }
  const db = drizzle(getRlsSql(), { schema });

  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`);
    await tx.execute(sql`select set_config('request.jwt.claim.sub', ${claims.sub}, true)`);
    await tx.execute(sql`set local role ${sql.raw(role)}`);
    return callback(tx);
  });
}
