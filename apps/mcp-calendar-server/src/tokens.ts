/**
 * Access-token lifecycle: decrypt, proactively refresh, reactively
 * refresh on 401, persist, and flip the connection to 'error' when the
 * grant is gone.
 *
 * This is the spec's internal `refresh_token(freelancerId)` tool. It is
 * deliberately NOT exposed as an MCP tool: the spec itself says it is
 * "invoked internally (not by FreeOps backend directly) whenever a call
 * hits an expired-token response". Exposing it would invite the caller to
 * drive token state, which is exactly the coupling this service exists to
 * prevent. It is a shared internal function instead.
 *
 * THE ROTATION GOTCHA (spec calls this "a common source of silent
 * breakage"): Microsoft issues a **new refresh token on every refresh and
 * invalidates the old one**. Google normally returns none and its
 * original stays valid. `persistRefreshedTokens` below therefore writes
 * `newTokens.refreshToken ?? previousRefreshToken` on *every* refresh,
 * unconditionally — never "only when it changed", never "only for
 * Microsoft". Miss this and a Microsoft connection works until the access
 * token expires, then breaks permanently and silently.
 */
import { decryptField, encryptField } from "@freeops/db/encryption";
import { TOKEN_REFRESH_SKEW_MS } from "./config.js";
import type { CalendarConnection, ConnectionStore } from "./connections.js";
import { ConnectionUnusableError, InvalidGrantError, ProviderApiError } from "./errors.js";
import type { CalendarProviderAdapter } from "./providers/types.js";

/** True when the stored expiry is unknown or within the proactive-refresh skew. */
export function needsProactiveRefresh(
  tokenExpiresAt: Date | null,
  now: Date = new Date(),
  skewMs: number = TOKEN_REFRESH_SKEW_MS
): boolean {
  // Unknown expiry → refresh rather than gamble on a stale access token.
  if (!tokenExpiresAt) return true;
  return tokenExpiresAt.getTime() - now.getTime() <= skewMs;
}

/**
 * Performs one refresh round trip and persists the result.
 *
 * On an invalid_grant-class failure the connection is flipped to `'error'`
 * (the DB check constraint allows active|revoked|error — the spec's
 * `"expired"` is an API-response word, not a column value) and
 * `InvalidGrantError` is thrown so the calling tool fails loudly with a
 * code the Next.js layer can turn into a "reconnect your calendar" prompt.
 * The alternative — swallowing it — leaves a connection reading 'active'
 * while every booking silently fails, which is the failure mode the spec
 * explicitly wants avoided.
 */
export async function refreshConnectionTokens(params: {
  store: ConnectionStore;
  adapter: CalendarProviderAdapter;
  connection: CalendarConnection;
}): Promise<{ accessToken: string; refreshToken: string; tokenExpiresAt: Date | null }> {
  const { store, adapter, connection } = params;
  const previousRefreshToken = decryptField(connection.refreshTokenEncrypted);

  let refreshed;
  try {
    refreshed = await adapter.refreshTokens({ refreshToken: previousRefreshToken });
  } catch (err) {
    if (err instanceof ProviderApiError && err.isInvalidGrant) {
      await store.setStatus(connection.id, "error");
      throw new InvalidGrantError(adapter.provider, err.message);
    }
    throw err;
  }

  // Rotation-safe persistence — see the module header. Google omits
  // `refreshToken`, so the previous one is carried forward; Microsoft
  // always supplies a new one, and dropping it would break the connection
  // on the *next* refresh, long after the change that caused it.
  const refreshToken = refreshed.refreshToken ?? previousRefreshToken;

  await store.persistTokens({
    connectionId: connection.id,
    accessTokenEncrypted: encryptField(refreshed.accessToken),
    refreshTokenEncrypted: encryptField(refreshToken),
    tokenExpiresAt: refreshed.expiresAt,
  });

  return {
    accessToken: refreshed.accessToken,
    refreshToken,
    tokenExpiresAt: refreshed.expiresAt,
  };
}

/**
 * Runs `fn` with a valid access token, handling both refresh triggers the
 * spec asks for:
 *
 *   - **proactive**: stored expiry within ~5 minutes (or unknown) → refresh
 *     before the call, so a request never burns a round trip discovering
 *     the token died mid-flight;
 *   - **reactive**: the provider answers 401 anyway (clock skew, a token
 *     revoked between refresh and use) → refresh once and retry exactly
 *     once. Never more than once: a second 401 after a fresh token is a
 *     real authorization problem, and retrying would just amplify load
 *     against the provider.
 */
export async function withAccessToken<T>(
  params: {
    store: ConnectionStore;
    adapter: CalendarProviderAdapter;
    connection: CalendarConnection;
    now?: Date;
  },
  fn: (accessToken: string) => Promise<T>
): Promise<T> {
  const { store, adapter, connection, now = new Date() } = params;

  if (connection.status !== "active") {
    throw new ConnectionUnusableError(connection.provider, connection.status);
  }

  let accessToken: string;
  let alreadyRefreshed = false;

  if (needsProactiveRefresh(connection.tokenExpiresAt, now)) {
    accessToken = (await refreshConnectionTokens({ store, adapter, connection })).accessToken;
    alreadyRefreshed = true;
  } else {
    accessToken = decryptField(connection.accessTokenEncrypted);
  }

  try {
    return await fn(accessToken);
  } catch (err) {
    const isUnauthorized = err instanceof ProviderApiError && err.isUnauthorized;
    if (!isUnauthorized || alreadyRefreshed) throw err;

    const retryToken = (await refreshConnectionTokens({ store, adapter, connection })).accessToken;
    return await fn(retryToken);
  }
}
