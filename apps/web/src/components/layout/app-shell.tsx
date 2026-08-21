import type { ReactNode } from "react";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

/**
 * Authenticated app shell wrapping every screen under (app) — Personal,
 * Business, Finance. Not applied to the public marketing site, auth pages,
 * or the public booking page, which each have their own minimal shells.
 */
export function AppShell({
  children,
  userEmail,
}: {
  children: ReactNode;
  userEmail?: string;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar userEmail={userEmail} />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>
      <MobileTabBar />
    </div>
  );
}
