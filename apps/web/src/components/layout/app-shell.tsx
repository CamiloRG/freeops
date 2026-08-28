import type { ReactNode } from "react";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { NavRail } from "@/components/layout/nav-rail";
import { AppThemeRoot } from "@/components/theme/app-theme-root";

/**
 * Authenticated app shell wrapping every screen under (app) — Personal,
 * Business, Finance. Not applied to the public marketing site, auth pages,
 * or the public booking page, which each have their own minimal shells.
 *
 * "Aero" README ("Interactions & behavior" → "Dark mode"): "app defaults to
 * dark" — `AppThemeRoot` is the wrapper that owns the `data-theme`
 * attribute for this whole subtree (see its own file comment for why it's
 * scoped here and not on `<html>`).
 */
export function AppShell({
  children,
  userEmail,
}: {
  children: ReactNode;
  userEmail?: string;
}) {
  return (
    <AppThemeRoot className="flex min-h-screen bg-bg">
      <NavRail userEmail={userEmail} />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <MobileTabBar />
    </AppThemeRoot>
  );
}
