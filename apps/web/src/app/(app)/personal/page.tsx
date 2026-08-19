import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export default function PersonalPage() {
  return (
    <SectionPlaceholder
      title="Personal"
      description="Your professional presence — profile, branding, resume, and booking link."
      phase="Phases 3–4"
      screens={[
        "Profile & personal data",
        "Banking details (masked, encrypted at rest)",
        "Tax information & documents (NIT/cédula, RUT)",
        "Branding (logo, applied to invoices & cuentas de cobro)",
        "Resume/CV builder (pull from completed projects)",
        "Scheduling setup (connect Google/Outlook calendar, booking link)",
      ]}
    />
  );
}
