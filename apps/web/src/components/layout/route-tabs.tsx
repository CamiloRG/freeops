"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type RouteTabItem = {
  href: string;
  label: string;
};

/**
 * Route-backed pill tabs — Aero's "Segmented control" treatment (4px
 * padding track in `--surface-sunken`, selected segment a white raised
 * pill) applied to URL-addressable routes rather than client-only state,
 * for the project-detail Resumen/Documentos/Tareas/Facturación tabs. A
 * sibling to `SectionTabs` (underline style, used nowhere anymore now that
 * the sidebar owns top-level section nav) — this is the pill variant the
 * new project-detail mocks use instead.
 */
export function RouteTabs({ items }: { items: RouteTabItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sección del proyecto"
      className="inline-flex w-fit items-center gap-0.5 rounded-pill bg-surface-sunken p-1"
    >
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-pill px-[14px] py-[7px] text-[13px] font-medium whitespace-nowrap transition-colors duration-fast ease-out",
              isActive
                ? "bg-surface text-ink shadow-[0_1px_2px_rgba(17,24,39,.06)]"
                : "text-ink-soft hover:text-ink"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
