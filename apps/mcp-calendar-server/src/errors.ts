/**
 * Typed errors for the calendar MCP server.
 *
 * Every error this server surfaces to its caller (the FreeOps Next.js
 * backend) carries a **stable string `code`**, never a human-readable
 * message the caller has to string-match on. app_spec.md § API Contracts
 * maps several of these 1:1 onto HTTP statuses in Stage 3:
 *
 *   SLOT_TAKEN        → 409 CONFLICT   (public booking, slot lost a race)
 *   NOT_CONNECTED     → 422            (no calendar connected yet)
 *   INVALID_GRANT     → 409/422 + "reconnect your calendar" prompt
 *   PROVIDER_ERROR    → 502 UPSTREAM_ERROR
 *   CONFIG_MISSING    → 500 (our own misconfiguration, never the user's)
 *
 * The spec's revocation-handling paragraph wants the invalid_grant class
 * "surfaced distinctly so FreeOps backend can flip connection.status" —
 * `INVALID_GRANT` is that distinct signal. Note the DB column itself is
 * set to `'error'` here (the check constraint allows active|revoked|error;
 * the spec's `"expired"` is an API-response-layer word, not a DB value).
 */

export type CalendarErrorCode =
  | "NOT_CONNECTED"
  | "CONNECTION_ERROR"
  | "SLOT_TAKEN"
  | "INVALID_GRANT"
  | "PROVIDER_ERROR"
  | "CONFIG_MISSING"
  | "INVALID_ARGUMENT";

/**
 * Base error for everything a tool call can fail with. `code` is the
 * contract; `message` is for logs and humans only.
 */
export class CalendarToolError extends Error {
  readonly code: CalendarErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: CalendarErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "CalendarToolError";
    this.code = code;
    this.details = details;
  }
}

/** The freelancer has no (non-deleted) connection for the requested provider. */
export class NotConnectedError extends CalendarToolError {
  constructor(freelancerId: string, provider: string) {
    super("NOT_CONNECTED", `No ${provider} calendar connection for freelancer ${freelancerId}.`, {
      provider,
    });
    this.name = "NotConnectedError";
  }
}

/** Connection exists but is not usable (status revoked/error). */
export class ConnectionUnusableError extends CalendarToolError {
  constructor(provider: string, status: string) {
    super("CONNECTION_ERROR", `The ${provider} calendar connection is '${status}', not 'active'.`, {
      provider,
      status,
    });
    this.name = "ConnectionUnusableError";
  }
}

/**
 * The slot was free when availability was computed but is busy now.
 * This is the race the spec calls out explicitly (two prospects on the
 * same public booking page); Stage 3 maps it to `409 CONFLICT`.
 */
export class SlotTakenError extends CalendarToolError {
  constructor(slotStart: Date, slotEnd: Date) {
    super("SLOT_TAKEN", "The requested slot is no longer free on the freelancer's calendar.", {
      slotStart: slotStart.toISOString(),
      slotEnd: slotEnd.toISOString(),
    });
    this.name = "SlotTakenError";
  }
}

/**
 * Refresh failed unrecoverably — the freelancer revoked consent from
 * their Google/Microsoft account settings, or the refresh token expired.
 * The connection's DB status has already been flipped to 'error' by the
 * time this is thrown.
 */
export class InvalidGrantError extends CalendarToolError {
  constructor(provider: string, cause?: string) {
    super(
      "INVALID_GRANT",
      `The ${provider} refresh token is no longer valid — the freelancer must reconnect their calendar.`,
      { provider, cause }
    );
    this.name = "InvalidGrantError";
  }
}

/** A FreeOps-owned platform secret is missing from this service's env. */
export class ConfigMissingError extends CalendarToolError {
  constructor(envVar: string) {
    super("CONFIG_MISSING", `Required environment variable ${envVar} is not set.`, { envVar });
    this.name = "ConfigMissingError";
  }
}

/**
 * A provider (Google/Microsoft) HTTP call failed. Adapters throw this;
 * the token-refresh orchestration inspects `status`/`isInvalidGrant` to
 * decide whether to refresh-and-retry, give up, or flip the connection to
 * 'error'.
 */
export class ProviderApiError extends CalendarToolError {
  readonly status: number | undefined;
  readonly provider: string;
  /** True for OAuth `invalid_grant` (and Graph's equivalents). */
  readonly isInvalidGrant: boolean;

  constructor(params: {
    provider: string;
    status?: number;
    message: string;
    isInvalidGrant?: boolean;
    body?: unknown;
  }) {
    super("PROVIDER_ERROR", `[${params.provider}] ${params.message}`, {
      provider: params.provider,
      status: params.status,
      body: params.body,
    });
    this.name = "ProviderApiError";
    this.provider = params.provider;
    this.status = params.status;
    this.isInvalidGrant = params.isInvalidGrant ?? false;
  }

  /** A 401 is the reactive-refresh trigger the spec asks for. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

/** Narrowing helper used by the MCP tool wrapper. */
export function isCalendarToolError(err: unknown): err is CalendarToolError {
  return err instanceof CalendarToolError;
}
