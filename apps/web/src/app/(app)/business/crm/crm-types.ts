export interface CrmOpportunity {
  id: string;
  stageId: string;
  title: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  estimatedValue: number | null;
  currency: string;
  expectedCloseDate: string | null;
  notes: string | null;
  source: string | null;
  closedAt: string | null;
  convertedProjectId: string | null;
  createdAt: string;
}

export interface CrmStage {
  id: string;
  name: string;
  position: number;
  isClosedWon: boolean;
  isClosedLost: boolean;
  isDefault?: boolean;
  opportunities: CrmOpportunity[];
}

/**
 * `crm_opportunities` has no `position` column (unlike `kanban_tasks`) — the
 * data model never specified a manually-orderable list within a stage, only
 * stage-to-stage movement. Cards render in a fixed, stable order (oldest
 * first) that is never persisted-reordered; a same-column drag is
 * therefore a display-only no-op (see `crm-board.tsx`'s `handleDragEnd`).
 */
export const OPPORTUNITY_SORT = (a: CrmOpportunity, b: CrmOpportunity) => a.createdAt.localeCompare(b.createdAt);
