import { withUserDb } from "@/lib/db/rls";
import { listOpportunities, listPipelineStages } from "@/lib/services/crm";
import { serializeOpportunity, serializeStage } from "@/lib/services/crm-view";
import { CrmBoard } from "./crm-board";
import type { CrmOpportunity, CrmStage } from "./crm-types";

export default async function CrmPage() {
  // `listPipelineStages` lazily seeds the 6 default stages on a caller's
  // very first visit — see `@/lib/services/crm`'s doc comment.
  const [stageRows, opportunityRows] = await withUserDb(async (tx, user) => {
    const stages = await listPipelineStages(tx, user.id);
    const opportunities = await listOpportunities(tx, user.id, {});
    return [stages, opportunities] as const;
  });

  const opportunitiesByStage = new Map<string, CrmOpportunity[]>();
  for (const row of opportunityRows) {
    const s = serializeOpportunity(row);
    const opportunity: CrmOpportunity = {
      id: s.id,
      stageId: s.stageId,
      title: s.title,
      clientName: s.clientName,
      clientEmail: s.clientEmail,
      clientPhone: s.clientPhone,
      estimatedValue: s.estimatedValue,
      currency: s.currency,
      expectedCloseDate: s.expectedCloseDate,
      notes: s.notes,
      source: s.source,
      closedAt: s.closedAt ? s.closedAt.toISOString() : null,
      convertedProjectId: s.convertedProjectId,
      createdAt: s.createdAt.toISOString(),
    };
    const list = opportunitiesByStage.get(opportunity.stageId) ?? [];
    list.push(opportunity);
    opportunitiesByStage.set(opportunity.stageId, list);
  }

  const initialStages: CrmStage[] = stageRows.map((row) => {
    const s = serializeStage(row);
    return {
      id: s.id,
      name: s.name,
      position: s.position,
      isClosedWon: s.isClosedWon,
      isClosedLost: s.isClosedLost,
      isDefault: s.isDefault,
      opportunities: opportunitiesByStage.get(row.id) ?? [],
    };
  });

  return <CrmBoard initialStages={initialStages} />;
}
