"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { NAV_ITEMS } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

/**
 * Desktop / tablet-landscape primary nav (≥768px). Collapses out of view in
 * favor of <MobileTabBar> below that breakpoint — see app_spec.md's UX
 * section 1 ("left sidebar ... collapsing to a bottom tab bar on mobile").
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-border md:bg-sidebar">
      <div className="flex h-16 items-center gap-2 px-6">
        <Logo />
      </div>
      <nav
        aria-label="Main"
        className="flex flex-1 flex-col gap-1 px-3 py-2"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
