"use client";

import { useCallback, useState } from "react";

/**
 * Shared state for the "collapsed summary + Edit button" interaction used
 * across Profile / Banking / Tax Info / Branding (and Resume's Basics
 * card) — see `SummaryEditCard`, which pairs with this hook for the common
 * case. Kept as a standalone hook (rather than folded into
 * `SummaryEditCard` itself) so a screen that needs to react to the
 * editing transition (e.g. resetting a draft back to the saved value on
 * cancel) can still own that logic while sharing the same boolean state
 * shape as every other screen.
 */
export function useEditToggle(initialEditing = false) {
  const [editing, setEditing] = useState(initialEditing);
  const toggle = useCallback(() => setEditing((e) => !e), []);
  return { editing, setEditing, toggle } as const;
}
