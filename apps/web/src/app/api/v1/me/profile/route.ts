/**
 * GET/PATCH /api/v1/me/profile — app_spec.md § "API Contracts &
 * Integrations" → "1. Freelancer profile, banking & tax data".
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse } from "@/lib/api/errors";
import { profileUpdateSchema } from "@/lib/validation/personal";
import { getOrCreateProfile, updateProfile } from "@/lib/services/profile";

function serializeProfile(profile: NonNullable<Awaited<ReturnType<typeof getOrCreateProfile>>>, email?: string) {
  return {
    id: profile.id,
    fullName: profile.fullName,
    displayName: profile.displayName,
    email,
    phone: profile.phone,
    country: profile.country,
    city: profile.city,
    headline: profile.headline,
    bio: profile.bio,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export async function GET() {
  try {
    const result = await withUserDb(async (tx, user) => {
      const profile = await getOrCreateProfile(tx, user.id, user.fullNameFromSignup);
      return serializeProfile(profile, user.email);
    });
    return NextResponse.json(result);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const input = profileUpdateSchema.parse(body);
    const result = await withUserDb(async (tx, user) => {
      const profile = await updateProfile(tx, user.id, input);
      return serializeProfile(profile, user.email);
    });
    return NextResponse.json(result);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
