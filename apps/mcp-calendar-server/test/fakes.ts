/**
 * Test doubles for the two seams the tool logic depends on: the
 * connection store and the provider adapter.
 *
 * The fake store deliberately holds **real ciphertext** produced by the
 * real `@freeops/db/encryption` module, not plaintext strings. That way a
 * test asserting "the rotated Microsoft refresh token was persisted" is
 * asserting on a value that actually round-tripped through the production
 * encryption path, rather than on a fake that quietly bypassed it.
 */
import { encryptField } from "@freeops/db/encryption";
import type {
  CalendarConnection,
  ConnectionStatus,
  ConnectionStore,
  PersistTokensInput,
  UpsertConnectionInput,
} from "../src/connections.js";
import type {
  BusyInterval,
  CalendarProvider,
  CalendarProviderAdapter,
  DeleteEventParams,
  FreeBusyParams,
  InsertEventParams,
  TokenSet,
} from "../src/providers/types.js";

/** A 32-byte base64 key, so `encryptField` works inside the suite. */
export const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

export function makeConnection(overrides: Partial<CalendarConnection> = {}): CalendarConnection {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    provider: "google",
    providerAccountEmail: "freelancer@example.com",
    accessTokenEncrypted: encryptField("access-token-v1"),
    refreshTokenEncrypted: encryptField("refresh-token-v1"),
    // Far in the future by default, so tests opt IN to a refresh.
    tokenExpiresAt: new Date("2999-01-01T00:00:00Z"),
    scope: null,
    externalCalendarId: null,
    status: "active",
    connectedAt: new Date("2026-01-01T00:00:00Z"),
    lastSyncedAt: null,
    ...overrides,
  };
}

export interface FakeStore extends ConnectionStore {
  connections: CalendarConnection[];
  setStatusCalls: { connectionId: string; status: ConnectionStatus }[];
  persistTokensCalls: PersistTokensInput[];
  upsertCalls: UpsertConnectionInput[];
}

export function createFakeStore(initial: CalendarConnection[] = []): FakeStore {
  const state: FakeStore = {
    connections: [...initial],
    setStatusCalls: [],
    persistTokensCalls: [],
    upsertCalls: [],

    async findByUserAndProvider(userId, provider) {
      return state.connections.find((c) => c.userId === userId && c.provider === provider) ?? null;
    },

    async listByUser(userId) {
      return state.connections.filter((c) => c.userId === userId);
    },

    async upsert(input) {
      state.upsertCalls.push(input);
      const existing = state.connections.find(
        (c) => c.userId === input.userId && c.provider === input.provider
      );
      const now = new Date("2026-06-01T00:00:00Z");
      if (existing) {
        Object.assign(existing, input, { status: "active" as const, connectedAt: now });
        return existing;
      }
      const created: CalendarConnection = {
        id: `conn-${state.connections.length + 1}`,
        status: "active",
        connectedAt: now,
        lastSyncedAt: null,
        ...input,
      };
      state.connections.push(created);
      return created;
    },

    async persistTokens(input) {
      state.persistTokensCalls.push(input);
      const conn = state.connections.find((c) => c.id === input.connectionId);
      if (conn) {
        conn.accessTokenEncrypted = input.accessTokenEncrypted;
        conn.refreshTokenEncrypted = input.refreshTokenEncrypted;
        conn.tokenExpiresAt = input.tokenExpiresAt;
      }
    },

    async setStatus(connectionId, status) {
      state.setStatusCalls.push({ connectionId, status });
      const conn = state.connections.find((c) => c.id === connectionId);
      if (conn) conn.status = status;
    },

    async touchLastSyncedAt(connectionId, at) {
      const conn = state.connections.find((c) => c.id === connectionId);
      if (conn) conn.lastSyncedAt = at;
    },
  };
  return state;
}

export interface FakeAdapterOptions {
  provider?: CalendarProvider;
  exchangeCode?: (params: { code: string; redirectUri: string }) => Promise<TokenSet>;
  refreshTokens?: (params: { refreshToken: string }) => Promise<TokenSet>;
  getAccountEmail?: () => Promise<string>;
  getBusyIntervals?: (params: FreeBusyParams) => Promise<BusyInterval[]>;
  insertEvent?: (params: InsertEventParams) => Promise<{ eventId: string }>;
  deleteEvent?: (params: DeleteEventParams) => Promise<void>;
}

export interface FakeAdapter extends CalendarProviderAdapter {
  calls: {
    exchangeCode: { code: string; redirectUri: string }[];
    refreshTokens: { refreshToken: string }[];
    getBusyIntervals: FreeBusyParams[];
    insertEvent: InsertEventParams[];
    deleteEvent: DeleteEventParams[];
  };
}

export function createFakeAdapter(options: FakeAdapterOptions = {}): FakeAdapter {
  const calls: FakeAdapter["calls"] = {
    exchangeCode: [],
    refreshTokens: [],
    getBusyIntervals: [],
    insertEvent: [],
    deleteEvent: [],
  };

  return {
    provider: options.provider ?? "google",
    scopes: ["test.scope"],
    calls,

    async exchangeCode(params) {
      calls.exchangeCode.push(params);
      if (options.exchangeCode) return options.exchangeCode(params);
      return {
        accessToken: "access-token-v1",
        refreshToken: "refresh-token-v1",
        expiresAt: new Date("2026-06-01T01:00:00Z"),
        scope: "test.scope",
      };
    },

    async refreshTokens(params) {
      calls.refreshTokens.push(params);
      if (options.refreshTokens) return options.refreshTokens(params);
      return { accessToken: "access-token-v2", expiresAt: new Date("2999-01-01T00:00:00Z") };
    },

    async getAccountEmail() {
      if (options.getAccountEmail) return options.getAccountEmail();
      return "freelancer@example.com";
    },

    async getBusyIntervals(params) {
      calls.getBusyIntervals.push(params);
      if (options.getBusyIntervals) return options.getBusyIntervals(params);
      return [];
    },

    async insertEvent(params) {
      calls.insertEvent.push(params);
      if (options.insertEvent) return options.insertEvent(params);
      return { eventId: "provider-event-1" };
    },

    async deleteEvent(params) {
      calls.deleteEvent.push(params);
      if (options.deleteEvent) return options.deleteEvent(params);
    },
  };
}

/** Builds an `AdapterRegistry` that always returns `adapter`. */
export function registryFor(adapter: CalendarProviderAdapter) {
  return () => adapter;
}
