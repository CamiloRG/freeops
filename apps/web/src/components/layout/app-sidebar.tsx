"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NAV_TREE } from "@/lib/nav-config";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/(auth)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * App-wide sidebar — icon rows, collapsible Personal/Negocios/Configuraciones
 * sections, a flat Principal/Finanzas row each, matching the new nav mocks
 * (245px, light surface, right hairline). Replaces the old flat 220px
 * `NavRail`. A section auto-expands when the active route is inside it;
 * otherwise it starts collapsed and toggles on click — no persistence
 * across reloads, this is a display convenience, not saved state.
 */
export function AppSidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();
  const [manuallyOpen, setManuallyOpen] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  const displayName = userEmail?.split("@")[0]?.replace(/[._]/g, " ") || "Cuenta";

  return (
    <aside className="hidden md:flex md:w-[245px] md:shrink-0 md:flex-col md:justify-between md:border-r md:border-line md:bg-surface">
      <div className="flex flex-col">
        <div className="flex items-center gap-2 px-5 pt-5 pb-5">
          <Logo size="sm" />
          <span className="ml-auto rounded-[6px] border border-line px-[7px] py-[2px] font-mono text-[10px] font-medium text-ink-muted uppercase">
            Pro
          </span>
        </div>

        <nav aria-label="Áreas" className="flex flex-col gap-0.5 px-3">
          {NAV_TREE.map((section) => {
            if (!section.children) {
              const isActive = pathname.startsWith(section.href!);
              const Icon = section.icon;
              return (
                <Link
                  key={section.label}
                  href={section.href!}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[10px] px-3 py-[9px] text-[14px] font-medium transition-colors duration-fast ease-out",
                    isActive ? "bg-accent-tint text-ink" : "text-ink-soft hover:bg-surface-sunken hover:text-ink"
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {section.label}
                </Link>
              );
            }

            const hasActiveChild = section.children.some((c) => pathname.startsWith(c.href));
            const isOpen = manuallyOpen[section.label] ?? hasActiveChild;
            const Icon = section.icon;

            return (
              <div key={section.label}>
                <button
                  type="button"
                  onClick={() => setManuallyOpen((s) => ({ ...s, [section.label]: !isOpen }))}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-[10px] px-3 py-[9px] text-[14px] font-medium transition-colors duration-fast ease-out",
                    hasActiveChild ? "text-ink" : "text-ink-soft hover:bg-surface-sunken hover:text-ink"
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 text-left">{section.label}</span>
                  {isOpen ? (
                    <ChevronDown className="size-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="size-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
                  )}
                </button>
                {isOpen && (
                  <div className="mt-0.5 flex flex-col gap-0.5 pl-[30px]">
                    {section.children.map((leaf) => {
                      const isActive = pathname === leaf.href || pathname.startsWith(`${leaf.href}/`);
                      return (
                        <Link
                          key={leaf.href}
                          href={leaf.href}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-2 rounded-[10px] px-3 py-[7px] text-[13px] transition-colors duration-fast ease-out",
                            isActive
                              ? "bg-accent-tint font-medium text-ink"
                              : "text-ink-soft hover:bg-surface-sunken hover:text-ink"
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn("size-1 shrink-0 rounded-full", isActive ? "bg-accent" : "bg-line")}
                          />
                          {leaf.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-2.5 border-t border-line px-4 py-3.5">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/15">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-tint text-[11px] font-semibold text-accent-press">
              {initials(displayName)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-ink capitalize">{displayName}</div>
              <div className="truncate text-[11px] text-ink-muted">Independiente</div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top">
            {userEmail && (
              <div className="truncate px-3 py-1.5 font-mono text-data-mono text-ink-muted">{userEmail}</div>
            )}
            <DropdownMenuItem
              variant="destructive"
              disabled={isPending}
              onSelect={() => startTransition(() => void signOut())}
            >
              {isPending ? "Saliendo…" : "Salir"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ThemeToggle iconOnly className="shrink-0 text-ink-muted transition-colors duration-fast ease-out hover:text-ink" />
      </div>
    </aside>
  );
}
