"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { APP_THEME_STORAGE_KEY } from "./app-theme-root";

type ThemeValue = "dark" | "light";

function readCurrentTheme(): ThemeValue {
  if (typeof document === "undefined") return "dark";
  const el = document.getElementById("app-theme-root");
  return el?.getAttribute("data-theme") === "light" ? "light" : "dark";
}

/**
 * Toggles the app shell's `data-theme` between dark (the default) and
 * light, persisting the choice to `localStorage` — pairs with
 * `AppThemeRoot`'s pre-hydration script. `iconOnly` renders a plain
 * sun/moon glyph (the sidebar footer's register in the new nav mocks)
 * instead of the earlier text label.
 */
export function ThemeToggle({
  className,
  iconOnly = false,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
  const [theme, setTheme] = useState<ThemeValue>("dark");

  useEffect(() => {
    // Deliberate one-time post-hydration correction, not a data sync loop:
    // the server always renders "dark" (`AppThemeRoot`'s real default) so
    // hydration never mismatches, and `AppThemeRoot`'s own inline script
    // may have already flipped the *DOM* to "light" pre-paint from
    // localStorage — this reads that back into React state once so the
    // button's label agrees with what's actually on screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(readCurrentTheme());
  }, []);

  function toggle() {
    const next: ThemeValue = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.getElementById("app-theme-root")?.setAttribute("data-theme", next);
    try {
      localStorage.setItem(APP_THEME_STORAGE_KEY, next);
    } catch {
      // Best-effort only — private browsing / storage-blocked contexts
      // still get a working in-session toggle, just not a persisted one.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={className}
      aria-pressed={theme === "light"}
      aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
    >
      {iconOnly ? (
        theme === "dark" ? (
          <Sun className="size-4" aria-hidden="true" />
        ) : (
          <Moon className="size-4" aria-hidden="true" />
        )
      ) : theme === "dark" ? (
        "modo claro"
      ) : (
        "modo oscuro"
      )}
    </button>
  );
}
