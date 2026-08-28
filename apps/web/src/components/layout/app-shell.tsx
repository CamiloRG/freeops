import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { AppThemeRoot } from "@/components/theme/app-theme-root";

/**
 * Authenticated app shell wrapping every screen under (app) — Personal,
 * Business, Finance, Settings. Composes the new icon+tree `AppSidebar`
 * (replacing the old flat `NavRail`) with the persistent `AppHeader` (which
 * now owns the breadcrumb — no more per-module `BreadcrumbHeader`).
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
      <AppSidebar userEmail={userEmail} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>
      <MobileTabBar />
    </AppThemeRoot>
  );
}
