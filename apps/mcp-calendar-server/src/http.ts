/**
 * Plain Node HTTP front door.
 *
 * Two routes, deliberately separate:
 *
 *  - `GET /healthz` → `200 ok`. A plain HTTP path, outside the MCP
 *    transport entirely, because Fly.io/Railway health checks issue an
 *    ordinary GET and expect a 2xx — they cannot speak JSON-RPC, so
 *    pointing them at the MCP endpoint would report the service as
 *    permanently unhealthy.
 *  - `POST|GET|DELETE /mcp` → the Streamable HTTP MCP transport.
 *
 * Transport choice: **Streamable HTTP, not stdio.** app_spec.md's
 * architecture puts the Next.js app on Vercel and this service on a
 * separate always-on container host, so there is no shared process for a
 * stdio sidecar to live in; the two must talk over the network.
 *
 * Session mode: **stateless**, with a fresh `McpServer` + transport per
 * request. Every tool here is a self-contained RPC that carries its own
 * `freelancerId` — there is no per-session state worth keeping — and
 * statelessness means the service can be scaled to N instances or
 * restarted mid-flight without a sticky-session router. Per-request
 * instances also stop concurrent requests from colliding over
 * transport-level request ids.
 *
 * Note there is no authentication layer here: per the spec this is an
 * internal, backend-to-backend service that "is not exposed to the
 * internet". Deployment must enforce that with private networking /
 * firewall rules (Fly private network, Railway internal networking). If it
 * ever needs a public address, a shared-secret bearer check belongs here —
 * flagged for the deployment stage.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "./server.js";
import type { ToolDeps } from "./tools.js";

export const MCP_PATH = "/mcp";
export const HEALTH_PATH = "/healthz";

async function handleMcpRequest(deps: ToolDeps, req: IncomingMessage, res: ServerResponse) {
  const server = buildMcpServer(deps);
  const transport = new StreamableHTTPServerTransport({
    // Stateless: no session id is generated or validated.
    sessionIdGenerator: undefined,
    // Answer with a plain JSON body rather than an SSE stream — every tool
    // here is a single request/response, and a JSON body is far easier for
    // the Next.js caller (and for curl) to consume.
    enableJsonResponse: true,
  });

  // Tear the per-request pair down once the response is finished, so a
  // long-lived process doesn't accumulate transports.
  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res);
}

/** Builds (but does not start) the HTTP server. */
export function createHttpServer(deps: ToolDeps): Server {
  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === HEALTH_PATH) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { "content-type": "text/plain", allow: "GET, HEAD" }).end("method not allowed");
        return;
      }
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end("ok");
      return;
    }

    if (url.pathname === MCP_PATH) {
      handleMcpRequest(deps, req, res).catch((err) => {
        console.error("[freeops-calendar] MCP request failed", err);
        if (!res.headersSent) {
          res.writeHead(500, { "content-type": "application/json" });
        }
        if (!res.writableEnded) {
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32603, message: "Internal server error" },
              id: null,
            })
          );
        }
      });
      return;
    }

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found");
  });
}
