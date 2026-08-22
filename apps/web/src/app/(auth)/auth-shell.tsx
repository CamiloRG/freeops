import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

export type AuthStat = { label: string; value: string; accent?: boolean };

/**
 * Shared split-panel shell for sign-in/sign-up (design_handoff_freeops_
 * ledger_quiet "Sign in" mock): `1fr 380px`, min-height 400px — explicitly
 * NOT a centered card. Left panel (`--surface-sunken`) carries the
 * wordmark, a headline + live-stats block, and a footer line; right panel
 * carries whatever form content the page passes as `children`. Sign-in
 * uses this with "welcome back" stats; sign-up (not mocked explicitly)
 * reuses the exact same shell with first-time-visitor copy instead — see
 * that page for the extrapolation.
 */
export function AuthShell({
  leftHeadline,
  leftStats,
  children,
}: {
  leftHeadline: string;
  leftStats: AuthStat[];
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[1fr_380px]">
      <div className="hidden flex-col justify-between bg-surface-sunken px-[44px] py-[36px] md:flex">
        <Logo size="md" />
        <div>
          <div className="max-w-[300px] text-[26px] leading-[1.15] font-medium tracking-[-0.02em] text-ink">
            {leftHeadline}
          </div>
          <div className="mt-[26px] flex flex-col gap-[14px]">
            {leftStats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center justify-between gap-4 text-caption text-ink-soft"
              >
                <span>{stat.label}</span>
                <span
                  className={`font-mono text-[11px] ${stat.accent ? "text-accent" : "text-ink"}`}
                >
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="font-mono text-[10.5px] text-ink-muted">
          freeops.co / acceso seguro
        </div>
      </div>

      <div className="flex flex-col justify-center px-[22px] py-[36px] md:justify-start md:px-[32px]">
        <div className="mb-8 md:hidden">
          <Logo size="md" />
        </div>
        {children}
      </div>
    </div>
  );
}
