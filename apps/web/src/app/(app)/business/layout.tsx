import type { ReactNode } from "react";

/**
 * Bare passthrough — Proyectos/Pipeline sub-navigation moved into the
 * app-wide sidebar (`AppSidebar`), so the old top-level `SectionTabs`
 * strip this layout used to render is gone. `/business/projects` and
 * `/business/projects/[id]/*` keep owning their own content padding.
 */
export default function BusinessLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
