/**
 * Google Calendar adapter — real Google API calls via `googleapis`.
 *
 * Scopes (app_spec.md Integrations §2): `calendar.events` +
 * `calendar.freebusy`, deliberately not Gmail, to keep the consent
 * surface — and Google's OAuth verification review — as small as
 * possible. `openid`/`email` are added on top purely so the code exchange
 * returns an `id_token` we can read `provider_account_email` from without
 * a second API and without the broader People-API scope; see
 * `getAccountEmail` for the fallback chain.
 *
 * The authorization URL itself (with `access_type=offline` +
 * `prompt=consent`, required to be issued a refresh token at all) is
 * built by the Next.js app in Stage 2 — it must request exactly
 * `GOOGLE_SCOPES` below.
 */
import { google, type Auth } from "googleapis";
import { getProviderCredentials } from "../config.js";
import { ProviderApiError } from "../errors.js";
import type {
  BusyInterval,
  CalendarProviderAdapter,
  DeleteEventParams,
  FreeBusyParams,
  InsertEventParams,
  TokenSet,
} from "./types.js";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "openid",
  "email",
] as const;

const DEFAULT_CALENDAR_ID = "primary";

/**
 * Normalizes anything thrown by googleapis/gaxios into a
 * `ProviderApiError`, preserving the HTTP status (so a 401 can trigger a
 * reactive refresh) and detecting the `invalid_grant` family (consent
 * revoked, refresh token expired) that must flip the connection to
 * 'error'.
 */
function toProviderError(err: unknown, context: string): ProviderApiError {
  const anyErr = err as {
    status?: number;
    code?: number | string;
    message?: string;
    response?: { status?: number; data?: unknown };
  };
  const status =
    anyErr?.response?.status ??
    (typeof anyErr?.status === "number" ? anyErr.status : undefined) ??
    (typeof anyErr?.code === "number" ? anyErr.code : undefined);

  const data = anyErr?.response?.data as { error?: string; error_description?: string } | undefined;
  const oauthError = typeof data?.error === "string" ? data.error : undefined;
  const message = anyErr?.message ?? "Unknown Google API error";

  // Google returns `{"error":"invalid_grant"}` with a 400 when the grant
  // is gone, which is emphatically NOT a retryable 401.
  const isInvalidGrant =
    oauthError === "invalid_grant" ||
    oauthError === "unauthorized_client" ||
    /invalid_grant/i.test(message);

  return new ProviderApiError({
    provider: "google",
    status,
    message: `${context}: ${oauthError ? `${oauthError} — ` : ""}${message}`,
    isInvalidGrant,
    body: data,
  });
}

function makeOAuthClient(redirectUri?: string): Auth.OAuth2Client {
  const { clientId, clientSecret } = getProviderCredentials("google");
  return new google.auth.OAuth2({ clientId, clientSecret, redirectUri });
}

function authedClient(accessToken: string): Auth.OAuth2Client {
  const client = makeOAuthClient();
  client.setCredentials({ access_token: accessToken });
  return client;
}

/** Google's `expiry_date` is epoch millis; absent means "unknown". */
function toExpiry(expiryDate: number | null | undefined): Date | null {
  return typeof expiryDate === "number" ? new Date(expiryDate) : null;
}

/**
 * Reads the `email` claim out of an OIDC id_token.
 *
 * The token was just received over TLS directly from Google's own token
 * endpoint in response to our client-authenticated request, so its
 * integrity is already established by the transport and there is nothing
 * for a local signature check to add. (This would not be true of an
 * id_token arriving from a client — that one must be verified.)
 */
function emailFromIdToken(idToken: string | null | undefined): string | null {
  if (!idToken) return null;
  const parts = idToken.split(".");
  if (parts.length < 2 || !parts[1]) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      email?: unknown;
    };
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

export function createGoogleAdapter(): CalendarProviderAdapter {
  return {
    provider: "google",
    scopes: GOOGLE_SCOPES,

    async exchangeCode({ code, redirectUri }): Promise<TokenSet> {
      const client = makeOAuthClient(redirectUri);
      try {
        const { tokens } = await client.getToken(code);
        if (!tokens.access_token) {
          throw new ProviderApiError({
            provider: "google",
            message: "Token exchange returned no access_token.",
          });
        }
        if (!tokens.refresh_token) {
          // Without `access_type=offline` + `prompt=consent`, or on a
          // re-consent Google considers redundant, no refresh token is
          // issued — and the schema requires one (NOT NULL). Fail loudly
          // at connect time rather than storing a connection that dies in
          // an hour.
          throw new ProviderApiError({
            provider: "google",
            message:
              "Token exchange returned no refresh_token — the authorization URL must set access_type=offline and prompt=consent.",
          });
        }
        return {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: toExpiry(tokens.expiry_date),
          scope: tokens.scope ?? null,
          idToken: tokens.id_token ?? null,
        };
      } catch (err) {
        if (err instanceof ProviderApiError) throw err;
        throw toProviderError(err, "exchangeCode");
      }
    },

    async refreshTokens({ refreshToken }): Promise<TokenSet> {
      const client = makeOAuthClient();
      client.setCredentials({ refresh_token: refreshToken });
      try {
        const { credentials } = await client.refreshAccessToken();
        if (!credentials.access_token) {
          throw new ProviderApiError({
            provider: "google",
            message: "Refresh returned no access_token.",
          });
        }
        return {
          accessToken: credentials.access_token,
          // Normally absent: Google refresh tokens are long-lived and do
          // not rotate. `tokens.ts` carries the previous one forward.
          refreshToken: credentials.refresh_token ?? undefined,
          expiresAt: toExpiry(credentials.expiry_date),
          scope: credentials.scope ?? null,
          idToken: credentials.id_token ?? null,
        };
      } catch (err) {
        if (err instanceof ProviderApiError) throw err;
        throw toProviderError(err, "refreshTokens");
      }
    },

    async getAccountEmail({ accessToken, tokens }): Promise<string> {
      // 1. The id_token from the exchange — free, no extra API call.
      const fromIdToken = emailFromIdToken(tokens?.idToken);
      if (fromIdToken) return fromIdToken;

      // 2. People API. Needs the granted `email`/`profile` scope; if the
      //    consent screen was configured without it this 403s and we fall
      //    through.
      try {
        const people = google.people({ version: "v1", auth: authedClient(accessToken) });
        const res = await people.people.get({
          resourceName: "people/me",
          personFields: "emailAddresses",
        });
        const primary =
          res.data.emailAddresses?.find((e) => e.metadata?.primary)?.value ??
          res.data.emailAddresses?.[0]?.value;
        if (primary) return primary;
      } catch {
        // fall through to (3)
      }

      // 3. Last resort: for a Google account the primary calendar's id IS
      //    the account's email address.
      try {
        const calendar = google.calendar({ version: "v3", auth: authedClient(accessToken) });
        const res = await calendar.calendars.get({ calendarId: DEFAULT_CALENDAR_ID });
        if (res.data.id) return res.data.id;
      } catch (err) {
        throw toProviderError(err, "getAccountEmail");
      }

      throw new ProviderApiError({
        provider: "google",
        message: "Could not determine the connected account's email address.",
      });
    },

    async getBusyIntervals({
      accessToken,
      calendarId,
      start,
      end,
    }: FreeBusyParams): Promise<BusyInterval[]> {
      const calendar = google.calendar({ version: "v3", auth: authedClient(accessToken) });
      const id = calendarId ?? DEFAULT_CALENDAR_ID;
      try {
        const res = await calendar.freebusy.query({
          requestBody: {
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
            // Ask for UTC explicitly. Google echoes RFC3339 instants with
            // offsets regardless, but pinning it removes any doubt about
            // what the returned strings mean.
            timeZone: "UTC",
            items: [{ id }],
          },
        });

        const cal = res.data.calendars?.[id];
        if (cal?.errors?.length) {
          throw new ProviderApiError({
            provider: "google",
            message: `freebusy.query reported calendar errors: ${cal.errors
              .map((e) => e.reason)
              .join(", ")}`,
            body: cal.errors,
          });
        }

        return (cal?.busy ?? [])
          .filter((b): b is { start: string; end: string } =>
            Boolean(b.start && b.end)
          )
          .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
      } catch (err) {
        if (err instanceof ProviderApiError) throw err;
        throw toProviderError(err, "getBusyIntervals");
      }
    },

    async insertEvent(params: InsertEventParams): Promise<{ eventId: string }> {
      const calendar = google.calendar({ version: "v3", auth: authedClient(params.accessToken) });
      try {
        const res = await calendar.events.insert({
          calendarId: params.calendarId ?? DEFAULT_CALENDAR_ID,
          // Spec: `sendUpdates: all` so the prospect gets the invitation.
          sendUpdates: "all",
          requestBody: {
            summary: params.summary,
            description: params.description,
            start: { dateTime: params.start.toISOString(), timeZone: "UTC" },
            end: { dateTime: params.end.toISOString(), timeZone: "UTC" },
            attendees: [{ email: params.attendeeEmail, displayName: params.attendeeName }],
          },
        });
        if (!res.data.id) {
          throw new ProviderApiError({
            provider: "google",
            message: "events.insert returned no event id.",
          });
        }
        return { eventId: res.data.id };
      } catch (err) {
        if (err instanceof ProviderApiError) throw err;
        throw toProviderError(err, "insertEvent");
      }
    },

    async deleteEvent(params: DeleteEventParams): Promise<void> {
      const calendar = google.calendar({ version: "v3", auth: authedClient(params.accessToken) });
      try {
        await calendar.events.delete({
          calendarId: params.calendarId ?? DEFAULT_CALENDAR_ID,
          eventId: params.eventId,
          sendUpdates: "all",
        });
      } catch (err) {
        const normalized = err instanceof ProviderApiError ? err : toProviderError(err, "deleteEvent");
        // Already deleted (404) or already cancelled (410) — cancelling a
        // booking must be idempotent, so both are success.
        if (normalized.status === 404 || normalized.status === 410) return;
        throw normalized;
      }
    },
  };
}
