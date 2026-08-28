"use client";

import { useEffect } from "react";
import { APP_THEME_STORAGE_KEY } from "./app-theme-root";

/**
 * Fallback to `AppThemeRoot`'s pre-hydration inline script, for the path
 * that script can't cover: signing in redirects into `/personal` via a
 * client-side Next.js transition (RSC payload, not a fresh HTML parse), so
 * the shell mounts without the browser ever re-running that inline
 * `<script>` — only a genuine full page load (hard refresh, typed URL)
 * does. This runs the identical correction once on mount as a safety net,
 * so a user's stored "light" preference still applies right after signing
 * in, not only after their next hard refresh.
 */
export function ThemeSync() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem(APP_THEME_STORAGE_KEY);
      if (stored === "light") {
        document.getElementById("app-theme-root")?.setAttribute("data-theme", "light");
      }
    } catch {
      // Best-effort only.
    }
  }, []);

  return null;
}
