import { NextResponse } from "next/server";

// Used by the deploy workflow's post-deploy smoke test (app_spec.md's DevOps
// section) to confirm the app is up before marking a deploy successful.
// Deliberately has no dependencies (DB, auth, etc.) yet — once those exist,
// keep this endpoint lightweight; a deep health check is a separate concern.
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "freeops-web",
    timestamp: new Date().toISOString(),
  });
}
