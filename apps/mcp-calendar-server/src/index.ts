/**
 * Entrypoint for `apps/mcp-calendar-server` — the FreeOps calendar MCP
 * server (app_spec.md Integrations §2).
 *
 * Wires the real collaborators (Drizzle-backed connection store, real
 * Google/Microsoft adapters) into the tool layer and starts the HTTP
 * server. Nothing but this file constructs production dependencies; every
 * other module takes them as arguments, which is what keeps the test suite
 * network- and DB-free.
 */
import { config as loadEnv } from "dotenv";
import { getPort } from "./config.js";
import { createDrizzleConnectionStore } from "./connections.js";
import { createHttpServer, HEALTH_PATH, MCP_PATH } from "./http.js";
import { defaultAdapterRegistry } from "./providers/index.js";
import type { ToolDeps } from "./tools.js";

// `.env.local` first, matching the convention every other app in this
// repo uses (and what `.env.example` tells you to create); `.env` is the
// fallback. Bare `dotenv/config` would read only `.env` and silently find
// nothing. On Fly.io/Railway neither file exists and real env vars win —
// dotenv never overwrites an already-set variable.
loadEnv({ path: [".env.local", ".env"], quiet: true });

function main(): void {
  // Fail fast on the two secrets every request needs, rather than at the
  // first tool call. The OAuth client credentials are deliberately NOT
  // checked here: they are read lazily per provider, so the service can
  // boot and serve `get_connection_status` with only one provider (or
  // neither) configured — useful while vendor-side setup is still pending.
  for (const required of ["DATABASE_URL", "ENCRYPTION_KEY"]) {
    if (!process.env[required]) {
      console.error(
        `[freeops-calendar] ${required} is not set — see apps/mcp-calendar-server/.env.example`
      );
      process.exit(1);
    }
  }

  const deps: ToolDeps = {
    store: createDrizzleConnectionStore(),
    adapters: defaultAdapterRegistry,
  };

  const port = getPort();
  const server = createHttpServer(deps);

  server.listen(port, () => {
    console.log(
      `[freeops-calendar] listening on :${port} (MCP ${MCP_PATH}, health ${HEALTH_PATH})`
    );
  });

  // Container hosts send SIGTERM on deploy/scale-down; drain in-flight
  // requests instead of dropping them.
  const shutdown = (signal: string) => {
    console.log(`[freeops-calendar] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
    // Don't hang forever on a stuck connection.
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
