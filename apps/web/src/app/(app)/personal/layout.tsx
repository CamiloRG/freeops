import type { ReactNode } from "react";
import { SectionTabs } from "@/components/layout/section-tabs";

const PERSONAL_TABS = [
  { href: "/personal/profile", label: "Profile" },
  { href: "/personal/banking", label: "Banking" },
  { href: "/personal/tax", label: "Tax Info" },
  { href: "/personal/branding", label: "Branding" },
  { href: "/personal/resume", label: "Resume/CV" },
];

/**
 * Shared shell for Phase 4's five in-scope Personal screens (Profile,
 * Banking, Tax Info, Branding, Resume/CV). Scheduling Setup / Public
 * Booking Page (screens 6-7) are explicitly Phase 8 — not linked here.
 */
export default function PersonalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Personal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your professional presence — profile, banking, tax info, branding, and resume.
        </p>
      </div>
      <SectionTabs items={PERSONAL_TABS} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
