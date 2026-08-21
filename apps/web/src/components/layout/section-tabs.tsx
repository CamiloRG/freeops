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
 * `Sidebar`'s own `usePathname().startsWith()` active-state convention.
 */
export function SectionTabs({ items }: { items: SectionTabItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Section" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="flex gap-1 border-b border-border">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
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
