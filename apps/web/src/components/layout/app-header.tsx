"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommandPalette } from "@/components/layout/command-palette";
import { NAV_LEAVES } from "@/lib/nav-config";

/**
 * Persistent top bar for the authenticated app shell, per the new nav mocks:
 * breadcrumb (computed from the route, replacing the old per-module
 * `BreadcrumbHeader` — one place now, not duplicated per section) on the
 * left, quick-switcher + Ayuda + "+Nuevo" on the right.
 *
 * "Ayuda" has nowhere real to go yet (no help center/support inbox exists)
 * — left disabled rather than faking a destination, same honesty call the
 * old rail made for "notificaciones". "+Nuevo" is real: it links straight
 * to the two screens that already own a working create flow (project /
 * CRM opportunity) rather than opening a fabricated global create dialog.
 */
export function AppHeader() {
  const pathname = usePathname();
  const breadcrumb =
    NAV_LEAVES.find((leaf) => pathname === leaf.href || pathname.startsWith(`${leaf.href}/`))?.breadcrumb ??
    "freeOps";

  return (
    <header className="flex h-[64px] shrink-0 items-center gap-4 border-b border-line bg-surface px-6">
      <div className="min-w-0 flex-1 truncate font-mono text-label-mono tracking-[0.14em] text-ink-muted uppercase">
        {breadcrumb}
      </div>

      <CommandPalette />

      <Button variant="ghost" size="sm" disabled title="Próximamente">
        Ayuda
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm">
            <Plus className="size-4" aria-hidden="true" />
            Nuevo
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href="/business/projects">Nuevo proyecto</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/business/crm">Nuevo deal</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
