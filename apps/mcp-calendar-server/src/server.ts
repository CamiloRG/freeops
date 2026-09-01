/**
 * MCP surface: registers the five tools on an `McpServer` and adapts
 * `tools.ts`'s typed results/errors into MCP `CallToolResult`s.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { isCalendarToolError } from "./errors.js";
import {
  connectCalendar,
  createBookingEvent,
  deleteEvent,
  getAvailability,
  getConnectionStatus,
  type ToolDeps,
} from "./tools.js";

export const SERVER_NAME = "freeops-calendar";
export const SERVER_VERSION = "0.1.0";

const providerSchema = z
  .enum(["google", "microsoft"])
  .describe("Which connected calendar provider to act against.");

const freelancerIdSchema = z
  .string()
  .uuid()
  .describe(
    "FreeOps user id. Trusted: the caller (the FreeOps Next.js backend) has already authenticated the session."
  );

const isoInstantSchema = z
  .string()
  .describe("ISO-8601 instant in UTC, e.g. 2026-08-20T14:00:00Z.");

/**
 * Wraps a tool body so every success is a JSON text block plus
 * `structuredContent`, and every failure is an `isError` result carrying
 * the stable `code` — never a stack trace and never a raw provider
 * message, which could contain token fragments or account detail.
 */
async function runTool<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  try {
    const result = await fn();
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result as Record<string, unknown>,
    };
  } catch (err) {
    if (isCalendarToolError(err)) {
      const payload = { code: err.code, message: err.message, details: err.details ?? {} };
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
      };
    }
    // Unexpected: log server-side, tell the caller only that it was
    // internal. Leaking `err.message` here risks echoing provider
    // responses that may embed identifiers.
    console.error("[freeops-calendar] unhandled tool error", err);
    const payload = { code: "INTERNAL_ERROR", message: "Internal error.", details: {} };
    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  }
}

/** Builds a fully-registered MCP server bound to `deps`. */
export function buildMcpServer(deps: ToolDeps): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  server.registerTool(
    "connect_calendar",
    {
      title: "Connect a calendar",
      description:
        "Exchanges an OAuth authorization code for tokens, stores them encrypted, and marks the freelancer's calendar connection active.",
      inputSchema: {
        freelancerId: freelancerIdSchema,
        provider: providerSchema,
        authorizationCode: z.string().min(1).describe("The one-time OAuth authorization code."),
        redirectUri: z
          .string()
          .url()
          .describe(
            "The exact redirect URI the code was issued against. Supplied per call because only the caller knows its own origin."
          ),
      },
    },
    async (args) => runTool(() => connectCalendar(deps, args))
  );

  server.registerTool(
    "get_availability",
    {
      title: "Get availability",
      description:
        "Returns bookable slots in [dateRangeStart, dateRangeEnd) after removing everything that overlaps the freelancer's provider free/busy. Bounds are UTC instants; the caller converts the freelancer's local availability window before calling.",
      inputSchema: {
        freelancerId: freelancerIdSchema,
        provider: providerSchema,
        dateRangeStart: isoInstantSchema,
        dateRangeEnd: isoInstantSchema,
        durationMinutes: z
          .number()
          .int()
          .positive()
          .describe("Meeting length, from booking_links.duration_minutes."),
        bufferMinutes: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe("Padding around meetings, from booking_links.buffer_minutes."),
      },
    },
    async (args) => runTool(() => getAvailability(deps, args))
  );

  server.registerTool(
    "create_booking_event",
    {
      title: "Create booking event",
      description:
        "Re-checks that the slot is still free, then writes the event with the prospect as an attendee and returns the provider event id. Fails with code SLOT_TAKEN if the slot was claimed in the meantime.",
      inputSchema: {
        freelancerId: freelancerIdSchema,
        provider: providerSchema,
        slotStart: isoInstantSchema,
        slotEnd: isoInstantSchema,
        prospectName: z.string().min(1),
        prospectEmail: z.string().email(),
        notes: z.string().optional(),
      },
    },
    async (args) => runTool(() => createBookingEvent(deps, args))
  );

  server.registerTool(
    "delete_event",
    {
      title: "Delete event",
      description:
        "Cancels/deletes a previously created booking event on the provider side. Idempotent: an already-deleted event succeeds.",
      inputSchema: {
        freelancerId: freelancerIdSchema,
        provider: providerSchema,
        providerEventId: z.string().min(1),
      },
    },
    async (args) => runTool(() => deleteEvent(deps, args))
  );

  server.registerTool(
    "get_connection_status",
    {
      title: "Get calendar connection status",
      description:
        "Read-only lookup of every calendar connection the freelancer has, with provider, account email, status and timestamps.",
      inputSchema: { freelancerId: freelancerIdSchema },
      annotations: { readOnlyHint: true },
    },
    async (args) => runTool(() => getConnectionStatus(deps, args))
  );

  return server;
}
