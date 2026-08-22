"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { BreadcrumbHeader } from "@/components/layout/breadcrumb-header";

const ProjectHeaderStatusContext = createContext<((status: ReactNode) => void) | null>(null);

/**
 * Business-module equivalent of Personal's `PersonalHeaderProvider`
 * (`(app)/personal/personal-header-context.tsx`) — same "layout needs
 * child-owned state" bridge (a screen's live `useSaveStatus()` value needs
 * to reach the `<BreadcrumbHeader>` the *layout* renders, across the App
 * Router's layout/page boundary), adapted for one real difference:
 * Personal's breadcrumb text is a pure function of the active tab
 * (computed client-side from `usePathname()` against a static tab list),
 * but a project's breadcrumb also needs the project's own title, which is
 * only known server-side — `[id]/layout.tsx` already fetched it via
 * `getOwnedProject` before rendering. So `breadcrumb` here is a plain
 * string prop threaded down from that Server Component, not recomputed
 * client-side, rather than a second client-side data fetch for the same
 * title. The status-bridging half (children register a `ReactNode` on
 * mount, cleared on unmount so switching tabs doesn't leak stale status
 * for a frame) is otherwise identical to Personal's.
 *
 * Named `project-*` rather than `business-*` deliberately — this context
 * is scoped to one project's Overview/Documents/Kanban tab shell, not the
 * whole Business area (the project *list* screen has no live per-form
 * status to bridge, so it renders `<BreadcrumbHeader>` directly with no
 * provider at all — see `project-list.tsx`).
 */
export function ProjectHeaderProvider({
  breadcrumb,
  children,
}: {
  breadcrumb: string;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<ReactNode>(null);

  return (
    <ProjectHeaderStatusContext.Provider value={setStatus}>
      <BreadcrumbHeader breadcrumb={breadcrumb} status={status} />
      {children}
    </ProjectHeaderStatusContext.Provider>
  );
}

/** Registers this screen's top-right status content into the project layout's `BreadcrumbHeader`. */
export function useProjectHeaderStatus(status: ReactNode) {
  const setStatus = useContext(ProjectHeaderStatusContext);
  useEffect(() => {
    setStatus?.(status);
    return () => setStatus?.(null);
  }, [setStatus, status]);
}
