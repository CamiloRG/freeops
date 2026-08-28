import type { ReactNode } from "react";

/**
 * Shared shell for the 5 Personal screens (Perfil, Banca, Tributario,
 * Marca, Hoja de vida). Scheduling Setup / Public Booking Page are
 * explicitly Phase 8 — not linked here.
 *
 * Per-screen navigation moved into the app-wide sidebar (`AppSidebar`) —
 * this layout no longer renders its own `SectionTabs`/breadcrumb (the top
 * `AppHeader` owns the breadcrumb now, computed from the route). Each
 * screen renders its own page-level heading via `PageHeader`.
 */
const PADDING = "px-9 pt-[26px] pb-8";

export default function PersonalLayout({ children }: { children: ReactNode }) {
  return <div className={PADDING}>{children}</div>;
}
