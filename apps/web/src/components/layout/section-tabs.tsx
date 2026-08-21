"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type SectionTabItem = {
  href: string;
  label: string;
};

/**
 * Route-backed sub-navigation for a top-level section (Personal now,
 * Business/Finance in later phases) — a horizontally-scrollable tab strip
 * that highlights the active sub-route. Deliberately plain `<Link>`s
 * styled like tabs (not the Radix `Tabs` primitive, which models
 * client-side-state tab panels, not URL-addressable routes) — matches
 * `NavRail`'s own `usePathname().startsWith()` active-state convention.
 *
 * "Ledger Quiet" treatment (README "Navigation" → "Tabs"): 12px, gap 22px,
 * `padding-bottom: 10px`. Active = `--ink` 500 weight + `border-bottom: 2px
 * solid --accent`. Rest = `--ink-soft` + transparent 2px border (prevents
 * layout shift on activate/hover) → `--ink` on hover. No pill, no box.
 */
export function SectionTabs({ items }: { items: SectionTabItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Section" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="flex gap-[22px]">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "shrink-0 border-b-2 pb-[10px] font-sans text-[12px] whitespace-nowrap transition-colors duration-fast ease-out",
                isActive
                  ? "border-b-accent font-medium text-ink"
                  : "border-b-transparent text-ink-soft hover:text-ink"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
