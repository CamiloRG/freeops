/**
 * Microsoft Graph adapter — real Microsoft identity platform + Graph
 * calls.
 *
 * Scopes (app_spec.md Integrations §2): `Calendars.ReadWrite` +
 * `offline_access` (required to be issued a refresh token at all), plus
 * `User.Read` so `GET /me` can supply `provider_account_email`. The
 * `common` tenant endpoint is used, per the decision already taken for
 * this app registration (multi-tenant, so no fixed tenant id is needed).
 *
 * ── Why a direct token-endpoint POST instead of @azure/msal-node ──
 * `ConfidentialClientApplication.acquireTokenByCode()` works, but msal-node
 * deliberately does not expose the refresh token on its
 * `AuthenticationResult` — refresh tokens live inside its own token cache,
 * which it expects to own and serialize. This service must hold the
 * refresh token itself, encrypted, in `calendar_connections`
 * (`refresh_token_encrypted` is NOT NULL, and the spec requires exclusive
 * ownership of it here), and must observe every rotation to persist the
 * replacement. Getting that out of msal means either reaching into its
 * cache internals or serializing/deserializing the whole cache per user —
 * both more fragile and more code than the ~40 lines below. The v2 token
 * endpoint is a stable, fully documented OAuth2 endpoint; using it
 * directly is the simpler and more honest integration, so msal-node is not
 * a dependency of this app.
 *
 * ── Refresh-token rotation ──
 * Microsoft returns a NEW refresh token on every refresh and invalidates
 * the previous one. The rotation is handled one layer up, in
 * `tokens.ts` — this adapter simply always reports the new token.
 */
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

const TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export const MICROSOFT_SCOPES = [
  "offline_access",
  "User.Read",
  "https://graph.microsoft.com/Calendars.ReadWrite",
] as const;

/**
 * Graph statuses that count as "the freelancer is not bookable".
 * Everything except `free` is treated as busy: `tentative` because a
 * held slot is not offerable, `oof` because they are away, and
 * `workingElsewhere` because they are in someone else's meeting room, not
 * available for a new prospect call. Conservative by design — offering a
 * slot that turns out to be taken is a far worse failure than hiding one.
 */
const FREE_STATUSES = new Set(["free"]);

interface TokenEndpointResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

function tokenErrorIsInvalidGrant(body: TokenEndpointResponse): boolean {
  if (body.error === "invalid_grant") return true;
  // AADSTS70000/AADSTS700082: refresh token expired or is no longer valid
  // (the classic "user revoked consent externally" signal).
  return /AADSTS(70000|700082|50173|65001)/.test(body.error_description ?? "");
}

async function postToken(form: Record<string, string>): Promise<TokenSet> {
  const { clientId, clientSecret } = getProviderCredentials("microsoft");
  const body = new URLSearchParams({ ...form, client_id: clientId, client_secret: clientSecret });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = (await res.json().catch(() => ({}))) as TokenEndpointResponse;

  if (!res.ok || json.error) {
    throw new ProviderApiError({
      provider: "microsoft",
      status: res.status,
      message: `${json.error ?? "token_endpoint_error"}: ${json.error_description ?? res.statusText}`,
      isInvalidGrant: tokenErrorIsInvalidGrant(json),
      body: { error: json.error, error_description: json.error_description },
    });
  }

  if (!json.access_token) {
    throw new ProviderApiError({
      provider: "microsoft",
      status: res.status,
      message: "Token endpoint returned no access_token.",
    });
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt:
      typeof json.expires_in === "number" ? new Date(Date.now() + json.expires_in * 1000) : null,
    scope: json.scope ?? null,
  };
}

async function graph<T>(params: {
  accessToken: string;
  method: "GET" | "POST" | "DELETE";
  path: string;
  body?: unknown;
  context: string;
}): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}${params.path}`, {
    method: params.method,
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      ...(params.body ? { "content-type": "application/json" } : {}),
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };
    throw new ProviderApiError({
      provider: "microsoft",
      status: res.status,
      message: `${params.context}: ${errBody.error?.code ?? res.status} ${
        errBody.error?.message ?? res.statusText
      }`,
      // Graph itself answers 401 for an expired access token — that is the
      // reactive-refresh trigger, not an invalid_grant. Only the token
      // endpoint can tell us the grant is truly gone.
      isInvalidGrant: false,
      body: errBody.error,
    });
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Graph returns `{ dateTime: "2026-08-20T14:00:00.0000000", timeZone: "UTC" }`
 * — an ISO-ish string with NO offset suffix plus a separate zone field.
 * `new Date(...)` on that string alone would be interpreted in the
 * *server's* local zone, silently shifting every busy interval by the
 * host's offset. That is exactly the DST/timezone bug class the spec
 * warns about, so the zone is applied explicitly here: we always request
 * UTC, and assert it on the way back rather than trusting the parser.
 */
export function parseGraphDateTime(value: { dateTime?: string; timeZone?: string }): Date | null {
  if (!value?.dateTime) return null;
  const raw = value.dateTime;
  const zone = (value.timeZone ?? "UTC").toUpperCase();
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/.test(raw);

  if (hasOffset) return new Date(raw);
  if (zone === "UTC") return new Date(`${raw}Z`);

  // We always ask Graph for UTC, so this branch means the response
  // disagreed with the request. Guessing a zone here would reintroduce the
  // bug; failing loudly is the correct move.
  throw new ProviderApiError({
    provider: "microsoft",
    message: `Graph returned a naive dateTime in an unexpected timeZone "${value.timeZone}" (expected UTC).`,
  });
}

/** Graph wants naive UTC wall-clock + an explicit `timeZone: "UTC"`. */
function toGraphDateTime(date: Date): { dateTime: string; timeZone: string } {
  return { dateTime: date.toISOString().replace(/Z$/, ""), timeZone: "UTC" };
}

interface ScheduleResponse {
  value?: {
    scheduleId?: string;
    scheduleItems?: {
      status?: string;
      start?: { dateTime?: string; timeZone?: string };
      end?: { dateTime?: string; timeZone?: string };
    }[];
    error?: { message?: string; responseCode?: string };
  }[];
}

export function createMicrosoftAdapter(): CalendarProviderAdapter {
  return {
    provider: "microsoft",
    scopes: MICROSOFT_SCOPES,

    async exchangeCode({ code, redirectUri }): Promise<TokenSet> {
      const tokens = await postToken({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        scope: MICROSOFT_SCOPES.join(" "),
      });
      if (!tokens.refreshToken) {
        // `offline_access` was missing from the consent request; the schema
        // requires a refresh token, so fail at connect time rather than
        // storing a connection that dies within the hour.
        throw new ProviderApiError({
          provider: "microsoft",
          message:
            "Token exchange returned no refresh_token — the authorization URL must request the offline_access scope.",
        });
      }
      return tokens;
    },

    async refreshTokens({ refreshToken }): Promise<TokenSet> {
      // The response's `refresh_token` is a NEW token; the one just used is
      // now dead. `tokens.ts` persists it on every single refresh.
      return postToken({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: MICROSOFT_SCOPES.join(" "),
      });
    },

    async getAccountEmail({ accessToken }): Promise<string> {
      const me = await graph<{ mail?: string | null; userPrincipalName?: string | null }>({
        accessToken,
        method: "GET",
        path: "/me",
        context: "getAccountEmail",
      });
      // Personal Microsoft accounts often have `mail: null`, with the
      // address only in `userPrincipalName`.
      const email = me.mail ?? me.userPrincipalName;
      if (!email) {
        throw new ProviderApiError({
          provider: "microsoft",
          message: "GET /me returned neither mail nor userPrincipalName.",
        });
      }
      return email;
    },

    async getBusyIntervals({
      accessToken,
      accountEmail,
      start,
      end,
    }: FreeBusyParams): Promise<BusyInterval[]> {
      const res = await graph<ScheduleResponse>({
        accessToken,
        method: "POST",
        path: "/me/calendar/getSchedule",
        context: "getBusyIntervals",
        body: {
          schedules: [accountEmail],
          startTime: toGraphDateTime(start),
          endTime: toGraphDateTime(end),
          // Coarsest allowed value: we read `scheduleItems` (exact event
          // bounds), not the `availabilityView` bitmap, so the interval
          // granularity is irrelevant to correctness and a larger value
          // keeps the response small.
          availabilityViewInterval: 60,
        },
      });

      const schedule = res.value?.[0];
      if (schedule?.error?.message) {
        throw new ProviderApiError({
          provider: "microsoft",
          message: `getSchedule reported an error for ${accountEmail}: ${schedule.error.message}`,
          body: schedule.error,
        });
      }

      const intervals: BusyInterval[] = [];
      for (const item of schedule?.scheduleItems ?? []) {
        if (FREE_STATUSES.has((item.status ?? "busy").toLowerCase())) continue;
        const itemStart = item.start ? parseGraphDateTime(item.start) : null;
        const itemEnd = item.end ? parseGraphDateTime(item.end) : null;
        if (itemStart && itemEnd) intervals.push({ start: itemStart, end: itemEnd });
      }
      return intervals;
    },

    async insertEvent(params: InsertEventParams): Promise<{ eventId: string }> {
      const path = params.calendarId ? `/me/calendars/${params.calendarId}/events` : "/me/events";
      const created = await graph<{ id?: string }>({
        accessToken: params.accessToken,
        method: "POST",
        path,
        context: "insertEvent",
        body: {
          subject: params.summary,
          body: { contentType: "text", content: params.description ?? "" },
          start: toGraphDateTime(params.start),
          end: toGraphDateTime(params.end),
          attendees: [
            {
              emailAddress: { address: params.attendeeEmail, name: params.attendeeName },
              type: "required",
            },
          ],
        },
      });
      if (!created.id) {
        throw new ProviderApiError({
          provider: "microsoft",
          message: "POST /me/events returned no event id.",
        });
      }
      return { eventId: created.id };
    },

    async deleteEvent(params: DeleteEventParams): Promise<void> {
      try {
        await graph<void>({
          accessToken: params.accessToken,
          method: "DELETE",
          path: `/me/events/${params.eventId}`,
          context: "deleteEvent",
        });
      } catch (err) {
        // Cancelling a booking must be idempotent.
        if (err instanceof ProviderApiError && (err.status === 404 || err.status === 410)) return;
        throw err;
      }
    },
  };
}
