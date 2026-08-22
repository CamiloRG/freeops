"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BreadcrumbHeader } from "@/components/layout/breadcrumb-header";
import { PERSONAL_TABS } from "./personal-tabs";

const PersonalHeaderStatusContext = createContext<((status: ReactNode) => void) | null>(null);

/**
 * Bridges the per-screen save-status content (a `<SaveStatusLine>`, a
 * static string like "cifrado en reposo", or nothing) up to the
 * `<BreadcrumbHeader>` this layout renders — the mocked Profile/Banking
 * screens put the breadcrumb+status row *above* the shared `<SectionTabs>`
 * (both owned by this layout, once, not duplicated per-screen), but the
 * status content is only known deep inside each screen's own client form
 * (its live `useSaveStatus()` state). A small context is the standard React
 * way to let a layout and a routed child page share one piece of UI state
 * without prop-drilling through the App Router's layout/page boundary.
 *
 * The breadcrumb text itself needs no such bridge — it's a pure function
 * of the active tab, computed here directly from the pathname.
 */
export function PersonalHeaderProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ReactNode>(null);
  const pathname = usePathname();
  const breadcrumb = useMemo(
    () => PERSONAL_TABS.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.breadcrumb ?? "PERSONAL",
    [pathname]
  );

  return (
    <PersonalHeaderStatusContext.Provider value={setStatus}>
      <BreadcrumbHeader breadcrumb={breadcrumb} status={status} />
      {children}
    </PersonalHeaderStatusContext.Provider>
  );
}

/**
 * Registers this screen's top-right status content into the
 * `BreadcrumbHeader` rendered by the shared Personal layout. Resets to
 * `null` on unmount so navigating to another tab doesn't leak stale status
 * into the next screen for a frame.
 */
export function usePersonalHeaderStatus(status: ReactNode) {
  const setStatus = useContext(PersonalHeaderStatusContext);
  useEffect(() => {
    setStatus?.(status);
    return () => setStatus?.(null);
  }, [setStatus, status]);
}
