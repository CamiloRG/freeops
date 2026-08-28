import type { ReactNode } from "react";
import { ThemeSync } from "./theme-sync";

const STORAGE_KEY = "freeops-theme";

/**
 * "Aero" dark-mode root for the authenticated app shell (README
 * "Interactions & behavior" → "Dark mode": "app defaults to dark; a user
 * preference toggles `data-theme` on the app shell and persists").
 *
 * Deliberately scoped to THIS wrapper, not `<html>` — the marketing site
 * must stay light regardless of what a signed-in user has chosen for the
 * app (its own hero/logo band carry a hardcoded `data-theme="dark"`
 * independent of this), and a single global toggle can't express both at
 * once. See `globals.css`'s `@custom-variant dark` comment for the rest of
 * this reasoning.
 *
 * SSR-safe with no flash: the server always renders `data-theme="dark"`
 * (the real default), and a tiny inline script — the standard pre-hydration
 * pattern for this problem, just id-scoped instead of targeting `<html>` —
 * flips it to "light" before first paint if that's what's in localStorage.
 * `ThemeToggle` (client component) reads/writes the same key at runtime.
 */
export function AppThemeRoot({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div id="app-theme-root" data-theme="dark" className={className}>
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem(${JSON.stringify(
            STORAGE_KEY
          )});if(t==="light"){var el=document.getElementById("app-theme-root");if(el)el.setAttribute("data-theme","light");}}catch(e){}})();`,
        }}
      />
      <ThemeSync />
      {children}
    </div>
  );
}

export { STORAGE_KEY as APP_THEME_STORAGE_KEY };
