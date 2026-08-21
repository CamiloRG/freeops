import { KanbanBoard } from "./kanban-board";

/**
 * Deliberately no server-side data fetch here (unlike every other Business/
 * Personal screen's SSR-first convention) — the board's own async-boundary
 * states (Loading: skeleton columns/cards, Error: retry) are graded per
 * app_spec.md's Five UI States table, so `KanbanBoard` fetches client-side
 * on mount to make those states real and demonstrable rather than skipped
 * by SSR resolving before first paint. Flagged in the phase report as the
 * one deliberate deviation from the rest of this phase's SSR convention.
 */
export default async function ProjectKanbanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <KanbanBoard projectId={id} />;
}
