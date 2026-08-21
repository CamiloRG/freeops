"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { NAV_ITEMS } from "@/lib/nav-config";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/(auth)/actions";

/**
 * "Ledger Quiet" nav rail (README "Navigation" → "Nav rail" + the mocked
 * Personal/Profile and Personal/Banking screens): 180px fixed, bg
 * `--surface-sunken`, wordmark, `ÁREAS` mono label, the three area links
 * with the active-item left-accent-border treatment, and a `PENDIENTES`
 * block. Replaces the old `Sidebar` + `TopBar` pair — this design has no
 * separate top bar at all.
 *
 * **Deliberate extension beyond the literal spec** (flagged per this
 * stage's instructions, also noted in the ADR): the mock doesn't show
 * where the old top bar's notification bell and account menu (sign-out)
 * go. Placed here as a small rail footer, near the wordmark, in the same
 * quiet mono-text register as the rest of the rail — "salir" is real,
 * wired sign-out (same Server Action as before); "notificaciones" is kept
 * as an inert placeholder in `--ink-faint` because the OLD bell had no
 * actual behavior either (no handler, no panel) — nothing functional is
 * being removed, only relocated and honestly represented as not-yet-built.
 *
 * The `PENDIENTES` block's real data source (PILA due date, overdue count)
 * doesn't exist until the Finance module (later phase) — rendered here
 * with static placeholder copy rather than fabricated live-looking numbers.
 */
export function NavRail({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <aside className="hidden md:flex md:w-[180px] md:shrink-0 md:flex-col md:justify-between md:bg-surface-sunken">
      <div>
        <div className="px-6 pt-6 pb-5">
          <Logo size="sm" />
        </div>
        <div className="px-6 pb-3 font-mono text-[10px] font-medium tracking-[0.06em] text-ink-muted uppercase">
          Áreas
        </div>
        <nav aria-label="Áreas" className="flex flex-col">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "border-l-2 px-6 py-[9px] text-[13px] transition-colors duration-fast ease-out",
                  isActive
                    ? "border-l-accent font-medium text-ink"
                    : "border-l-transparent text-ink-soft hover:text-ink"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-6 pt-7 pb-2.5 font-mono text-[10px] font-medium tracking-[0.06em] text-ink-muted uppercase">
          Pendientes
        </div>
        <div className="px-6 text-[12px] leading-[1.9] text-ink-soft">
          PILA del mes <span className="font-mono text-[10.5px] text-ink-faint">— sin datos aún</span>
        </div>
      </div>

      <div className="px-6 py-5">
        {userEmail ? (
          <div
            className="mb-2 truncate font-mono text-[10px] text-ink-faint"
            title={userEmail}
          >
            {userEmail}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <span
            className="font-mono text-[10.5px] tracking-[0.02em] text-ink-faint"
            title="Próximamente"
          >
            notificaciones
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(() => {
                void signOut();
              });
            }}
            className="font-mono text-[10.5px] tracking-[0.02em] text-ink-muted transition-colors duration-fast ease-out hover:text-accent disabled:pointer-events-none disabled:text-ink-faint"
          >
            {isPending ? "saliendo…" : "salir"}
          </button>
        </div>
      </div>
    </aside>
  );
}
