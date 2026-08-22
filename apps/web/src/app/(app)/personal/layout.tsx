import type { ReactNode } from "react";
import { SectionTabs } from "@/components/layout/section-tabs";
import { PersonalHeaderProvider } from "./personal-header-context";
import { PERSONAL_TABS } from "./personal-tabs";

/**
 * Shared shell for the 5 in-scope Personal screens (Perfil, Banca,
 * Tributario, Marca, Hoja de vida). Scheduling Setup / Public Booking Page
 * are explicitly Phase 8 — not linked here.
 *
 * "Ledger Quiet" restyle (README "Layout" → the mocked Personal/Profile and
 * Personal/Banking screens): asymmetric, left-aligned content area — no
 * `mx-auto`/`max-w-3xl` centering anywhere in this system. Content padding
 * is exactly the handoff's own `content-padding: 26px top / 36px sides /
 * 32px bottom` layout constant. Top to bottom: breadcrumb + status (via
 * `PersonalHeaderProvider`, see that file for why a small context is used
 * to bridge each screen's live save-status into this shared header) →
 * `SectionTabs` (kept as the one shared instance here, not duplicated per
 * screen) → each screen's own section heading/fields/action row.
 */
const PADDING = "px-9 pt-[26px] pb-8";

export default function PersonalLayout({ children }: { children: ReactNode }) {
  return (
    <div className={PADDING}>
      <PersonalHeaderProvider>
        <div className="mt-5">
          <SectionTabs items={PERSONAL_TABS} />
        </div>
        <div className="mt-[26px]">{children}</div>
      </PersonalHeaderProvider>
    </div>
  );
}
