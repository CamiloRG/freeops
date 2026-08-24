import type { ReactNode } from "react";
import { SectionTabs } from "@/components/layout/section-tabs";

/**
 * Phase 6: Business now has two top-level sections — Proyectos (Phase 5)
 * and Pipeline CRM (this phase) — so it gets the same route-backed
 * `SectionTabs` strip Personal's module layout established
 * (`(app)/personal/layout.tsx`), added here for the first time.
 *
 * Deliberately additive-only, NOT a full copy of `PersonalLayout`'s shape:
 * `/business/projects` and `/business/projects/[id]/*` already own their
 * own `px-9 pt-[26px] pb-8` content padding and breadcrumb (the latter
 * pixel-verified across 3 prior stages) — re-wrapping them in another
 * padded container here would double that padding. This layout only adds
 * the tabs strip, inset to the same `px-9` left edge so it lines up with
 * the content below, and lets every child route keep managing its own
 * padding exactly as before.
 */
const TABS = [
  { href: "/business/projects", label: "Proyectos" },
  { href: "/business/crm", label: "Pipeline CRM" },
];

export default function BusinessLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="px-9 pt-[18px]">
        <SectionTabs items={TABS} />
      </div>
      {children}
    </div>
  );
}
