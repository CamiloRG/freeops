/**
 * "Ledger Quiet" field-editing behavior (README "Interactions & behavior"
 * → "Field editing": "Dirty state enables the primary button; clean state
 * renders it disabled"). Plain-object form state in this module has no
 * functions/dates/Maps, so a `JSON.stringify` comparison is a safe,
 * dependency-free way to detect "has anything changed since the last
 * saved snapshot" without hand-rolling a field-by-field diff per screen.
 */
export function isDirty<T>(current: T, saved: T): boolean {
  return JSON.stringify(current) !== JSON.stringify(saved);
}
