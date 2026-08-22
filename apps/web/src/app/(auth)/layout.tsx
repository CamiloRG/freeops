import type { ReactNode } from "react";

/**
 * "Ledger Quiet" auth pages are a split panel (see `AuthShell`), not a
 * centered card — this layout is now just a bare passthrough (the old
 * version centered a `<Logo>` + card here; each page's own `<AuthShell>`
 * now owns the wordmark placement instead, since the left/right panels
 * need the full viewport height).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-paper">{children}</div>;
}
