import { withUserDb } from "@/lib/db/rls";
import { getOrCreateBranding } from "@/lib/services/branding";
import { getOrCreateProfile } from "@/lib/services/profile";
import { getSignedDownloadUrl } from "@/lib/storage/r2";
import { BrandingForm } from "./branding-form";

export default async function BrandingPage() {
  const { branding, logoUrl, fullName } = await withUserDb(async (tx, user) => {
    const branding = await getOrCreateBranding(tx, user.id);
    const profile = await getOrCreateProfile(tx, user.id, user.fullNameFromSignup);
    const logoUrl = branding.logoFileKey
      ? await getSignedDownloadUrl("brandingLogos", branding.logoFileKey)
      : null;
    return { branding, logoUrl, fullName: profile.fullName };
  });

  return (
    <BrandingForm
      initial={{
        logoUrl,
        primaryColor: branding.primaryColor ?? "#6C5CE7",
        secondaryColor: branding.secondaryColor ?? "#2B2A26",
      }}
      fullName={fullName}
    />
  );
}
