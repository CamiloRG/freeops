/**
 * `apps/web`-side convenience wrapper around `@freeops/db`'s
 * `withRlsContext` (see that file's doc comment for the underlying
 * mechanism). Every Server Action / Route Handler / Server Component that
 * reads or writes user-owned data should go through `withUserDb` here
 * rather than importing `withRlsContext` directly, so the
 * "validate via getUser(), then reuse that token for RLS" sequencing lives
 * in exactly one place.
 *
 * Why `getUser()` *and* `getSession()`: Supabase's own guidance is that
 * `getSession()` alone must never be trusted server-side because it reads
 * the session from cookies without contacting the Auth server, so a
 * tampered/stale cookie could lie about who the caller is. `getUser()`
 * round-trips to Supabase's Auth server and is the real check. We still
 * need the raw access-token *string* to hand to Postgres (RLS needs the
 * JWT itself, not just the decoded user object), so `getSession()` is used
 * purely as a way to read that string back out of the already-verified
 * cookie-backed session — never as the source of truth for *who* the user
 * is.
 */
import { withRlsContext, type RlsTx } from "@freeops/db/rls-client";
import { createClient } from "@/lib/supabase/server";

export class UnauthorizedError extends Error {
  constructor(message = "No valid session.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export interface RequestUser {
  id: string;
  email: string | undefined;
  /** From Supabase `user_metadata.full_name`, set at sign-up — used only as a fallback default when auto-creating a profile row on first access. */
  fullNameFromSignup: string | undefined;
}

/**
 * Verifies the current request's Supabase session and returns both the
 * authenticated user and the raw access token, for callers that need to
 * fan the token out to more than one `withRlsContext` call (rare — prefer
 * `withUserDb` below for the common single-call case).
 */
export async function requireUser(): Promise<{ user: RequestUser; accessToken: string }> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new UnauthorizedError();
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new UnauthorizedError();
  }

  const fullNameFromSignup =
    typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : undefined;

  return {
    user: { id: user.id, email: user.email, fullNameFromSignup },
    accessToken: session.access_token,
  };
}

/**
 * Runs `callback` inside an RLS-scoped Drizzle transaction for the current
 * request's authenticated user. Throws `UnauthorizedError` if there is no
 * valid session — callers (Route Handlers) should catch that and respond
 * `401 UNAUTHORIZED` per the API contract's standard error envelope.
 */
export async function withUserDb<T>(
  callback: (tx: RlsTx, user: RequestUser) => Promise<T>
): Promise<T> {
  const { user, accessToken } = await requireUser();
  return withRlsContext(accessToken, (tx) => callback(tx, user));
}
