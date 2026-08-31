/**
 * POST /api/v1/admin/regulatory-config-alerts/:id/acknowledge — the first
 * endpoint under `/api/v1/admin`. This is the "human in the loop" action
 * for `@/lib/admin/regulatory-alerts`'s alert queue (see that file's doc
 * comment): a platform admin reviewing `/admin`'s top-priority normativa
 * banner marks one alert as reviewed.
 *
 * Same real authorization check as `(admin)/admin/layout.tsx` (a
 * `platform_admins` lookup via `isPlatformAdmin`, not just "is signed
 * in") — this route sits outside that route group's layout gate, so it
 * has to do its own check rather than inherit one.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/admin/is-admin";
import { acknowledgeRegulatoryConfigAlert } from "@/lib/admin/regulatory-alerts";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";

export const runtime = "nodejs";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse("UNAUTHORIZED", "No hay una sesión válida.");
    }
    if (!(await isPlatformAdmin(user.id))) {
      return apiErrorResponse("FORBIDDEN", "No tienes acceso al panel de administración.");
    }

    const { id } = await params;
    const updated = await acknowledgeRegulatoryConfigAlert(id, user.id);
    if (!updated) {
      return apiErrorResponse("NOT_FOUND", "Alerta no encontrada.");
    }
    return NextResponse.json(updated);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
