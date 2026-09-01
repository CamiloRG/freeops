/**
 * The provider-adapter seam.
 *
 * Google Calendar and Microsoft Graph disagree about almost everything
 * that matters here — free/busy request shape, free/busy response shape,
 * event object schema, error codes, whether refresh tokens rotate. The
 * spec's own justification for carving this MCP server out as a separate
 * service is exactly that isolation ("keeps all provider-specific quirks …
 * isolated in one internal service"). This interface is where that
 * isolation actually lands: everything above it (slot slicing, token
 * refresh orchestration, re-check-before-write, DB upserts) is
 * provider-agnostic and therefore unit-testable against a fake adapter,
 * with zero network access.
 *
 * There is no live Google/Microsoft Calendar-scope test account reachable
 * from CI yet (vendor-side OAuth setup is still pending), so this seam is
 * also what makes the Stage-1 test suite possible at all: the tests mock
 * *this interface*, never the tool logic itself. The real adapters
 * (`./google.ts`, `./microsoft.ts`) make real API calls — they are not
 * stubs — they are simply not exercised by the automated suite until
 * Stage 2/3 can run a real OAuth round trip.
 */

export type CalendarProvider = "google" | "microsoft";

/** A half-open [start, end) interval during which the freelancer is busy. */
export interface BusyInterval {
  start: Date;
  end: Date;
}

/**
 * Tokens as returned by a code exchange or a refresh.
 *
 * `refreshToken` is optional on refresh **only** because Google usually
 * omits it (its refresh tokens are long-lived and don't rotate). Microsoft
 * always returns a new one and it MUST be persisted — see
 * `tokens.ts`'s `refreshConnectionTokens`.
 */
export interface TokenSet {
  accessToken: string;
  /** Absent on a Google refresh; always present on Microsoft. */
  refreshToken?: string;
  /** Null when the provider didn't say; treated as "refresh eagerly". */
  expiresAt: Date | null;
  scope?: string | null;
  /** Google only: the OIDC id_token, when `openid email` scopes were granted. */
  idToken?: string | null;
}

export interface InsertEventParams {
  accessToken: string;
  /** Provider-side calendar id; `"primary"`/`undefined` means the default calendar. */
  calendarId?: string | null;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  attendeeName: string;
  attendeeEmail: string;
}

export interface DeleteEventParams {
  accessToken: string;
  calendarId?: string | null;
  eventId: string;
}

export interface FreeBusyParams {
  accessToken: string;
  calendarId?: string | null;
  /** Provider account email — Graph's `getSchedule` addresses calendars by address. */
  accountEmail: string;
  start: Date;
  end: Date;
}

/**
 * The whole provider surface this server needs. Deliberately small: six
 * operations, all of them expressed in UTC `Date`s and plain strings, so
 * nothing provider-shaped leaks upward.
 *
 * Every method throws `ProviderApiError` on failure, with `status` set
 * (so a 401 triggers a reactive refresh) and `isInvalidGrant` set for the
 * consent-revoked class.
 */
export interface CalendarProviderAdapter {
  readonly provider: CalendarProvider;
  /** OAuth scopes this adapter's authorization URL must request (Stage 2 builds that URL). */
  readonly scopes: readonly string[];

  /** Authorization-code → tokens. `redirectUri` is passed per call, see `tools.ts`. */
  exchangeCode(params: { code: string; redirectUri: string }): Promise<TokenSet>;

  /**
   * refresh_token grant. Implementations MUST return the provider's new
   * refresh token when one is issued (Microsoft rotates every time).
   */
  refreshTokens(params: { refreshToken: string }): Promise<TokenSet>;

  /** The connected account's own email address, for `provider_account_email`. */
  getAccountEmail(params: { accessToken: string; tokens?: TokenSet }): Promise<string>;

  /** Normalized busy intervals overlapping [start, end). Merging is the caller's job. */
  getBusyIntervals(params: FreeBusyParams): Promise<BusyInterval[]>;

  /** Creates the booking event with the prospect as an attendee; returns the provider event id. */
  insertEvent(params: InsertEventParams): Promise<{ eventId: string }>;

  /** Cancels/deletes the event. Must resolve (not throw) if it is already gone. */
  deleteEvent(params: DeleteEventParams): Promise<void>;
}
