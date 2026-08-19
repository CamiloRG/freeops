import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export default function BusinessPage() {
  return (
    <SectionPlaceholder
      title="Business"
      description="Projects, contracts, kanban boards, and your CRM pipeline."
      phase="Phases 5–6"
      screens={[
        "Project list & detail",
        "Contract, amendment, appendix & change-order documents",
        "Per-project kanban board (customizable columns)",
        "CRM pipeline board",
        "Closed-won → auto-created project automation",
      ]}
    />
  );
}
