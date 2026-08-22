import type { ReactNode } from "react";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { NavRail } from "@/components/layout/nav-rail";

/**
 * Authenticated app shell wrapping every screen under (app) — Personal,
 * Business, Finance. Not applied to the public marketing site, auth pages,
 * or the public booking page, which each have their own minimal shells.
 *
 * "Ledger Quiet" replaces the old `Sidebar` + `TopBar` pair with a single
 * `NavRail` — this design has no separate top bar (see `NavRail`'s own
 * comment for where the old bell/account-menu functionality moved).
 * `MobileTabBar` is kept for the <768px breakpoint; it already inherits the
 * new palette via the shared `--sidebar-*` tokens without needing its own
 * rewrite this stage.
 */
export function AppShell({
  children,
  userEmail,
}: {
  children: ReactNode;
  userEmail?: string;
}) {
  return (
    <div className="flex min-h-screen bg-paper">
      <NavRail userEmail={userEmail} />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <MobileTabBar />
    </div>
  );
}
