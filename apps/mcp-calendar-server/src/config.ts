/**
 * Environment configuration for the calendar MCP server.
 *
 * Per app_spec.md's secret taxonomy, the only secrets this service holds
 * in its own env are **FreeOps-owned platform credentials** — the two
 * OAuth client id/secret pairs, the DB URL, and the field-encryption key.
 * No per-user secret ever lives in env: those are per-freelancer OAuth
 * tokens, encrypted at rest in `calendar_connections`.
 *
 * Note what is deliberately NOT here: the OAuth **redirect URI**. It is
 * passed in per call by the Next.js app (which knows its own request
 * origin, and differs between local dev, preview deploys and production),
 * so this service stays deployment-domain-agnostic and one deployed
 * instance can serve several FreeOps origins.
 */
import { ConfigMissingError } from "./errors.js";
import type { CalendarProvider } from "./providers/types.js";

export interface ProviderCredentials {
  clientId: string;
  clientSecret: string;
}

const ENV_KEYS: Record<CalendarProvider, { id: string; secret: string }> = {
  google: { id: "GOOGLE_CALENDAR_CLIENT_ID", secret: "GOOGLE_CALENDAR_CLIENT_SECRET" },
  microsoft: { id: "MICROSOFT_CALENDAR_CLIENT_ID", secret: "MICROSOFT_CALENDAR_CLIENT_SECRET" },
};

/**
 * Reads the platform OAuth client credentials for one provider.
 *
 * Read lazily at call time (never at module load) so importing this
 * module — as the test suite does — doesn't require credentials that only
 * exist once the vendor-side Calendar-scope setup is done.
 */
export function getProviderCredentials(provider: CalendarProvider): ProviderCredentials {
  const keys = ENV_KEYS[provider];
  const clientId = process.env[keys.id];
  const clientSecret = process.env[keys.secret];
  if (!clientId) throw new ConfigMissingError(keys.id);
  if (!clientSecret) throw new ConfigMissingError(keys.secret);
  return { clientId, clientSecret };
}

/** HTTP port. Fly.io/Railway inject `PORT`; 8787 is the local default. */
export function getPort(): number {
  const raw = process.env.PORT;
  if (!raw) return 8787;
  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`PORT must be a valid TCP port number, got "${raw}".`);
  }
  return port;
}

/**
 * Proactive-refresh window: refresh when the stored `token_expires_at` is
 * within this many milliseconds of now. The spec asks for "~5 min before
 * expiry".
 */
export const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;
