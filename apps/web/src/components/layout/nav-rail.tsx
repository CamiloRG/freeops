"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NAV_ITEMS } from "@/lib/nav-config";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/(auth)/actions";

/**
 * "Aero" app rail (README "Navigation" → "App rail" + screen 2, "App
 * dashboard"): 220px fixed, bg `--surface-sunken`, right border `--line`,
 * wordmark, then items at `padding 10px 12px`, radius 12, 14/500. Active =
 * bg `--accent-tint`, text `--ink`, accent dot; rest = text `--ink-soft`,
 * `--line` dot. Replaces Ledger Quiet's 180px underline-style rail.
 *
 * **Deliberate omissions vs. the literal spec**, both flagged: (1) the
 * spec's "trial/upgrade card pinned to the bottom" is dropped — FreeOps has
 * no billing tiers yet (Phase 12/Stripe not built), so a trial-upsell card
 * would be fabricating a plan that doesn't exist; (2) trailing per-item
 * counts (`data-mono --ink-muted`) aren't rendered since none of the three
 * sections has a real live count source at this stage — same "don't
 * fabricate a live-looking number" call the Ledger Quiet rail made for its
 * PILA due-date line.
 */
export function NavRail({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <aside className="hidden md:flex md:w-[220px] md:shrink-0 md:flex-col md:justify-between md:border-r md:border-line md:bg-surface-sunken">
      <div>
        <div className="px-5 pt-6 pb-5">
          <Logo size="sm" />
        </div>
        <nav aria-label="Áreas" className="flex flex-col gap-0.5 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-[12px] px-3 py-[10px] text-[14px] font-medium transition-colors duration-fast ease-out",
                  isActive
                    ? "bg-accent-tint text-ink"
                    : "text-ink-soft hover:bg-surface hover:text-ink"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-[6px] shrink-0 rounded-full",
                    isActive ? "bg-accent" : "bg-line"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-3 border-t border-line px-4 py-4">
        {userEmail ? (
          <div
            className="truncate font-mono text-data-mono text-ink-muted"
            title={userEmail}
          >
            {userEmail}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <ThemeToggle className="font-mono text-data-mono text-ink-muted transition-colors duration-fast ease-out hover:text-ink" />
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(() => {
                void signOut();
              });
            }}
            className="font-mono text-data-mono text-ink-muted transition-colors duration-fast ease-out hover:text-critical-ink disabled:pointer-events-none disabled:opacity-50"
          >
            {isPending ? "saliendo…" : "salir"}
          </button>
        </div>
      </div>
    </aside>
  );
}
