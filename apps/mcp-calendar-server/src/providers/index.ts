/**
 * Adapter registry. The tool layer resolves an adapter by provider name
 * through this function and never imports a concrete adapter directly —
 * which is what lets the test suite hand the tools a fake registry
 * instead.
 */
import { createGoogleAdapter, GOOGLE_SCOPES } from "./google.js";
import { createMicrosoftAdapter, MICROSOFT_SCOPES } from "./microsoft.js";
import type { CalendarProvider, CalendarProviderAdapter } from "./types.js";

export type { CalendarProvider, CalendarProviderAdapter } from "./types.js";
export { GOOGLE_SCOPES, MICROSOFT_SCOPES };

export type AdapterRegistry = (provider: CalendarProvider) => CalendarProviderAdapter;

/**
 * Adapters are constructed per call rather than memoized: they read their
 * OAuth client credentials lazily from env on each use, so nothing is
 * captured at module load and importing this file never requires the
 * (currently still pending) vendor credentials to be present.
 */
export const defaultAdapterRegistry: AdapterRegistry = (provider) => {
  switch (provider) {
    case "google":
      return createGoogleAdapter();
    case "microsoft":
      return createMicrosoftAdapter();
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unsupported calendar provider: ${String(exhaustive)}`);
    }
  }
};
