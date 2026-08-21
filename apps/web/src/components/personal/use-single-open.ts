"use client";

import { useCallback, useState } from "react";

/**
 * Accordion-style "single open at a time" state, keyed by an id. Backs
 * `CollapsibleEntryRow` lists (Resume's Experience entries today).
 * Multi-open was considered and rejected: with dense per-row summaries
 * (title · company · dates) stacked in one card, several entries expanded
 * simultaneously push the page height around unpredictably as you click
 * through them — matches the mockup's accordion behavior.
 */
export function useSingleOpen<T extends string | number = number>(initial: T | null = null) {
  const [openKey, setOpenKey] = useState<T | null>(initial);
  const isOpen = useCallback((key: T) => openKey === key, [openKey]);
  const toggle = useCallback((key: T) => setOpenKey((k) => (k === key ? null : key)), []);
  return { openKey, isOpen, toggle, setOpenKey } as const;
}
