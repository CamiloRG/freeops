/**
 * Token-refresh orchestration.
 *
 * The two cases app_spec.md singles out as silent-failure sources get the
 * most attention here:
 *   - Microsoft's rotating refresh token must be PERSISTED on every
 *     refresh (dropping it breaks the connection one hour later, not now);
 *   - an `invalid_grant` refresh failure must flip the DB status to
 *     'error' and surface distinctly, rather than leaving a connection
 *     reading 'active' while every booking silently fails.
 */
import { describe, expect, it } from "vitest";
import { decryptField } from "@freeops/db/encryption";
import { ProviderApiError } from "../src/errors.js";
import { needsProactiveRefresh, refreshConnectionTokens, withAccessToken } from "../src/tokens.js";
import { createFakeAdapter, createFakeStore, makeConnection } from "./fakes.js";

const NOW = new Date("2026-06-01T12:00:00Z");

describe("needsProactiveRefresh", () => {
  it("refreshes when the token expires inside the 5-minute skew", () => {
    expect(needsProactiveRefresh(new Date("2026-06-01T12:04:00Z"), NOW)).toBe(true);
  });

  it("does not refresh a token with plenty of life left", () => {
    expect(needsProactiveRefresh(new Date("2026-06-01T12:30:00Z"), NOW)).toBe(false);
  });

  it("refreshes when the expiry is unknown rather than gambling", () => {
    expect(needsProactiveRefresh(null, NOW)).toBe(true);
  });

  it("refreshes an already-expired token", () => {
    expect(needsProactiveRefresh(new Date("2026-06-01T11:00:00Z"), NOW)).toBe(true);
  });
});

describe("refreshConnectionTokens — Microsoft rotation", () => {
  it("persists the NEW rotated refresh token, encrypted", async () => {
    const connection = makeConnection({ provider: "microsoft" });
    const store = createFakeStore([connection]);
    const adapter = createFakeAdapter({
      provider: "microsoft",
      async refreshTokens({ refreshToken }) {
        expect(refreshToken).toBe("refresh-token-v1");
        // Microsoft invalidates the token just used and issues a new one.
        return {
          accessToken: "ms-access-v2",
          refreshToken: "ms-refresh-v2-ROTATED",
          expiresAt: new Date("2026-06-01T13:00:00Z"),
        };
      },
    });

    const result = await refreshConnectionTokens({ store, adapter, connection });

    expect(result.refreshToken).toBe("ms-refresh-v2-ROTATED");
    expect(store.persistTokensCalls).toHaveLength(1);

    const persisted = store.persistTokensCalls[0]!;
    // Decrypting through the real encryption module is the point: this
    // asserts the rotated value actually reached storage, not that a
    // function was called.
    expect(decryptField(persisted.refreshTokenEncrypted)).toBe("ms-refresh-v2-ROTATED");
    expect(decryptField(persisted.accessTokenEncrypted)).toBe("ms-access-v2");
    expect(persisted.tokenExpiresAt?.toISOString()).toBe("2026-06-01T13:00:00.000Z");
  });

  it("persists a rotation on EVERY refresh, not only the first", async () => {
    const connection = makeConnection({ provider: "microsoft" });
    const store = createFakeStore([connection]);
    let generation = 1;
    const adapter = createFakeAdapter({
      provider: "microsoft",
      async refreshTokens({ refreshToken }) {
        // Each refresh must present the token issued by the previous one.
        expect(refreshToken).toBe(generation === 1 ? "refresh-token-v1" : `ms-refresh-v${generation}`);
        generation += 1;
        return {
          accessToken: `ms-access-v${generation}`,
          refreshToken: `ms-refresh-v${generation}`,
          expiresAt: new Date("2026-06-01T13:00:00Z"),
        };
      },
    });

    await refreshConnectionTokens({ store, adapter, connection });
    await refreshConnectionTokens({ store, adapter, connection });
    await refreshConnectionTokens({ store, adapter, connection });

    expect(store.persistTokensCalls).toHaveLength(3);
    expect(decryptField(connection.refreshTokenEncrypted)).toBe("ms-refresh-v4");
  });

  it("carries the previous refresh token forward when Google omits one", async () => {
    const connection = makeConnection({ provider: "google" });
    const store = createFakeStore([connection]);
    const adapter = createFakeAdapter({
      provider: "google",
      // Google's refresh response normally has no refresh_token at all.
      async refreshTokens() {
        return { accessToken: "g-access-v2", expiresAt: new Date("2026-06-01T13:00:00Z") };
      },
    });

    const result = await refreshConnectionTokens({ store, adapter, connection });

    expect(result.refreshToken).toBe("refresh-token-v1");
    expect(decryptField(store.persistTokensCalls[0]!.refreshTokenEncrypted)).toBe(
      "refresh-token-v1"
    );
  });
});

describe("refreshConnectionTokens — revoked consent", () => {
  it("flips the connection to 'error' and throws INVALID_GRANT on invalid_grant", async () => {
    const connection = makeConnection();
    const store = createFakeStore([connection]);
    const adapter = createFakeAdapter({
      async refreshTokens() {
        throw new ProviderApiError({
          provider: "google",
          status: 400,
          message: "invalid_grant — Token has been expired or revoked.",
          isInvalidGrant: true,
        });
      },
    });

    await expect(refreshConnectionTokens({ store, adapter, connection })).rejects.toMatchObject({
      code: "INVALID_GRANT",
    });

    expect(store.setStatusCalls).toEqual([{ connectionId: connection.id, status: "error" }]);
    expect(connection.status).toBe("error");
    // Nothing was written to the token columns on a failed refresh.
    expect(store.persistTokensCalls).toHaveLength(0);
  });

  it("does NOT flip status for an ordinary transient provider failure", async () => {
    const connection = makeConnection();
    const store = createFakeStore([connection]);
    const adapter = createFakeAdapter({
      async refreshTokens() {
        throw new ProviderApiError({
          provider: "google",
          status: 503,
          message: "backendError",
        });
      },
    });

    await expect(refreshConnectionTokens({ store, adapter, connection })).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
    });
    expect(store.setStatusCalls).toHaveLength(0);
    expect(connection.status).toBe("active");
  });
});

describe("withAccessToken", () => {
  it("uses the stored access token when it is still fresh", async () => {
    const connection = makeConnection({ tokenExpiresAt: new Date("2026-06-01T13:00:00Z") });
    const store = createFakeStore([connection]);
    const adapter = createFakeAdapter();

    const seen = await withAccessToken({ store, adapter, connection, now: NOW }, async (t) => t);

    expect(seen).toBe("access-token-v1");
    expect(adapter.calls.refreshTokens).toHaveLength(0);
  });

  it("refreshes proactively when the token expires within the skew", async () => {
    const connection = makeConnection({ tokenExpiresAt: new Date("2026-06-01T12:02:00Z") });
    const store = createFakeStore([connection]);
    const adapter = createFakeAdapter();

    const seen = await withAccessToken({ store, adapter, connection, now: NOW }, async (t) => t);

    expect(seen).toBe("access-token-v2");
    expect(adapter.calls.refreshTokens).toHaveLength(1);
  });

  it("refreshes reactively on a 401 and retries the call once", async () => {
    const connection = makeConnection({ tokenExpiresAt: new Date("2026-06-01T13:00:00Z") });
    const store = createFakeStore([connection]);
    const adapter = createFakeAdapter();

    const tokensSeen: string[] = [];
    const result = await withAccessToken(
      { store, adapter, connection, now: NOW },
      async (token) => {
        tokensSeen.push(token);
        if (tokensSeen.length === 1) {
          throw new ProviderApiError({ provider: "google", status: 401, message: "invalid token" });
        }
        return "ok";
      }
    );

    expect(result).toBe("ok");
    expect(tokensSeen).toEqual(["access-token-v1", "access-token-v2"]);
    expect(adapter.calls.refreshTokens).toHaveLength(1);
  });

  it("does not retry a second time when the refreshed token also 401s", async () => {
    const connection = makeConnection({ tokenExpiresAt: new Date("2026-06-01T13:00:00Z") });
    const store = createFakeStore([connection]);
    const adapter = createFakeAdapter();

    let attempts = 0;
    await expect(
      withAccessToken({ store, adapter, connection, now: NOW }, async () => {
        attempts += 1;
        throw new ProviderApiError({ provider: "google", status: 401, message: "invalid token" });
      })
    ).rejects.toMatchObject({ status: 401 });

    expect(attempts).toBe(2);
    expect(adapter.calls.refreshTokens).toHaveLength(1);
  });

  it("does not retry after a proactive refresh already happened", async () => {
    const connection = makeConnection({ tokenExpiresAt: new Date("2026-06-01T12:02:00Z") });
    const store = createFakeStore([connection]);
    const adapter = createFakeAdapter();

    let attempts = 0;
    await expect(
      withAccessToken({ store, adapter, connection, now: NOW }, async () => {
        attempts += 1;
        throw new ProviderApiError({ provider: "google", status: 401, message: "invalid token" });
      })
    ).rejects.toMatchObject({ status: 401 });

    expect(attempts).toBe(1);
    expect(adapter.calls.refreshTokens).toHaveLength(1);
  });

  it("refuses to act on a connection that is not active", async () => {
    const connection = makeConnection({ status: "error" });
    const store = createFakeStore([connection]);
    const adapter = createFakeAdapter();

    await expect(
      withAccessToken({ store, adapter, connection, now: NOW }, async (t) => t)
    ).rejects.toMatchObject({ code: "CONNECTION_ERROR" });
  });

  it("propagates a non-401 provider error untouched", async () => {
    const connection = makeConnection({ tokenExpiresAt: new Date("2026-06-01T13:00:00Z") });
    const store = createFakeStore([connection]);
    const adapter = createFakeAdapter();

    await expect(
      withAccessToken({ store, adapter, connection, now: NOW }, async () => {
        throw new ProviderApiError({ provider: "google", status: 500, message: "boom" });
      })
    ).rejects.toMatchObject({ status: 500 });

    expect(adapter.calls.refreshTokens).toHaveLength(0);
  });
});
