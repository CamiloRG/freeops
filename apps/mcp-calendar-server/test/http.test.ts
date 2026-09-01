/**
 * Wiring smoke tests for the HTTP front door: the plain health path that
 * Fly.io/Railway will poll, and a real MCP round trip over the Streamable
 * HTTP transport (initialize → tools/list → tools/call) against an
 * in-process server with faked provider and store.
 *
 * This is the only place the MCP SDK itself is exercised; everything else
 * tests the logic directly.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createHttpServer } from "../src/http.js";
import type { ToolDeps } from "../src/tools.js";
import { createFakeAdapter, createFakeStore, makeConnection, registryFor } from "./fakes.js";

const FREELANCER_ID = "22222222-2222-4222-8222-222222222222";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const store = createFakeStore([
    makeConnection({ userId: FREELANCER_ID, provider: "google" }),
  ]);
  const deps: ToolDeps = {
    store,
    adapters: registryFor(createFakeAdapter()),
    now: () => new Date("2026-06-01T12:00:00Z"),
  };
  server = createHttpServer(deps);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const PROTOCOL_VERSION = "2025-06-18";

/**
 * One JSON-RPC POST against the stateless MCP endpoint.
 *
 * Because the server is stateless, each POST is independent: an
 * `initialize` request is not required first, but the protocol requires
 * every non-initialize request to carry `Mcp-Protocol-Version`. (The
 * current protocol revision also forbids batching an `initialize`
 * alongside other messages, which is why each call here is its own
 * request.)
 */
async function mcpPost(body: unknown, isInitialize = false): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // The transport requires the client to accept both.
      accept: "application/json, text/event-stream",
      ...(isInitialize ? {} : { "mcp-protocol-version": PROTOCOL_VERSION }),
    },
    body: JSON.stringify(body),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as Record<string, unknown>;
}

const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "test-client", version: "0.0.0" },
  },
};

describe("GET /healthz", () => {
  it("answers 200 ok on a plain GET, outside the MCP protocol", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("404s an unknown path", async () => {
    const res = await fetch(`${baseUrl}/nope`);
    expect(res.status).toBe(404);
  });
});

describe("POST /mcp", () => {
  it("completes an MCP initialize handshake", async () => {
    const body = await mcpPost(INITIALIZE, true);
    const result = body.result as { serverInfo?: { name?: string } };
    expect(result?.serverInfo?.name).toBe("freeops-calendar");
  });

  it("advertises all five tools", async () => {
    const body = await mcpPost({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });

    const listing = body as { result?: { tools?: { name: string }[] } };
    const names = (listing.result?.tools ?? []).map((t) => t.name).sort();
    expect(names).toEqual([
      "connect_calendar",
      "create_booking_event",
      "delete_event",
      "get_availability",
      "get_connection_status",
    ]);
  });

  it("runs get_connection_status end to end through the transport", async () => {
    const body = (await mcpPost({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "get_connection_status",
        arguments: { freelancerId: FREELANCER_ID },
      },
    })) as { result?: { isError?: boolean; structuredContent?: { connections?: unknown[] } } };

    expect(body.result?.isError).toBeFalsy();
    expect(body.result?.structuredContent?.connections).toHaveLength(1);
  });

  it("returns a tool error (not a transport error) with a stable code", async () => {
    const body = (await mcpPost({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "delete_event",
        arguments: {
          // A valid uuid with no connection behind it.
          freelancerId: "44444444-4444-4444-8444-444444444444",
          provider: "google",
          providerEventId: "evt-x",
        },
      },
    })) as { result?: { isError?: boolean; structuredContent?: { code?: string } } };

    // A failed tool is a successful JSON-RPC call whose result carries
    // isError — the caller must be able to read the code, not parse a
    // protocol-level error.
    expect(body.result?.isError).toBe(true);
    expect(body.result?.structuredContent?.code).toBe("NOT_CONNECTED");
  });
});
