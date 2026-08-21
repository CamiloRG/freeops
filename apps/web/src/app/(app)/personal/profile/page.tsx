import { withUserDb } from "@/lib/db/rls";
import { getOrCreateProfile } from "@/lib/services/profile";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const profile = await withUserDb((tx, user) => getOrCreateProfile(tx, user.id, user.fullNameFromSignup));

  return (
    <ProfileForm
      initial={{
        fullName: profile.fullName,
        displayName: profile.displayName ?? "",
        phone: profile.phone ?? "",
        city: profile.city ?? "",
        country: profile.country,
        headline: profile.headline ?? "",
        bio: profile.bio ?? "",
      }}
    />
  );
}
