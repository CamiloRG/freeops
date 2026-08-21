"use client"

import { useCallback, useState } from "react"

/**
 * "Ledger Quiet" save-feedback pattern (README "Save feedback" +
 * "Interactions & behavior" → "Save"): no toasts — on save, the top-right
 * mono status line changes to `guardado HH:MM`; errors surface as an
 * inline notice above the action row (see `<InlineNotice variant="danger">`
 * in `components/ui/inline-notice.tsx`), not through this line.
 *
 * This stage only builds the pattern — it is not yet wired into a real form
 * (stage 2 wires it into Personal's Profile/Banking screens). Usage once
 * wired:
 *
 *   const saveStatus = useSaveStatus();
 *   async function onSave() {
 *     saveStatus.markSaving();
 *     try {
 *       await save();
 *       saveStatus.markSaved();
 *     } catch (err) {
 *       saveStatus.markError(errorMessage(err));
 *     }
 *   }
 *   <BreadcrumbHeader breadcrumb="PERSONAL / PERFIL" status={<SaveStatusLine status={saveStatus} />} />
 *   {saveStatus.status === "error" && (
 *     <InlineNotice variant="danger" title="ERROR" description={saveStatus.errorMessage} />
 *   )}
 */
export type SaveStatusValue =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; savedAt: Date }
  | { status: "error"; errorMessage?: string };

export type UseSaveStatusReturn = SaveStatusValue & {
  markSaving: () => void;
  markSaved: (at?: Date) => void;
  markError: (message?: string) => void;
  reset: () => void;
};

export function useSaveStatus(): UseSaveStatusReturn {
  const [state, setState] = useState<SaveStatusValue>({ status: "idle" });

  const markSaving = useCallback(() => setState({ status: "saving" }), []);
  const markSaved = useCallback(
    (at: Date = new Date()) => setState({ status: "saved", savedAt: at }),
    []
  );
  const markError = useCallback(
    (message?: string) => setState({ status: "error", errorMessage: message }),
    []
  );
  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { ...state, markSaving, markSaved, markError, reset };
}

/** `guardado HH:MM` — 24h, local time, per the README's exact copy shape. */
export function formatSavedAt(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `guardado ${hh}:${mm}`;
}
