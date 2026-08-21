import { withUserDb } from "@/lib/db/rls";
import { getResumeFull } from "@/lib/services/resume";
import { getSignedDownloadUrl } from "@/lib/storage/r2";
import { getConnectionSummary } from "@/lib/services/ai-connections";
import { DEFAULT_TIER_MONTHLY_LIMIT, isUnderDefaultTierLimit } from "@/lib/ai/rate-limit";
import { ResumeForm } from "./resume-form";

export default async function ResumePage() {
  const { initial, aiImport } = await withUserDb(async (tx, user) => {
    const { resume, entries, skills } = await getResumeFull(tx, user.id);
    const lastGeneratedPdfUrl = resume.lastGeneratedPdfKey
      ? await getSignedDownloadUrl("resumeExports", resume.lastGeneratedPdfKey)
      : null;

    // AI-assisted resume import (user-proposed feature beyond
    // app_spec.md's original scope, see the codebase-memory-mcp ADR) —
    // surface remaining default-tier quota / BYOK-connected status
    // alongside the existing resume data load.
    const connection = await getConnectionSummary(tx, user.id, "anthropic");
    const byokConnected = Boolean(connection?.verifiedAt);
    const quota = byokConnected ? null : await isUnderDefaultTierLimit(tx, user.id);

    return {
      initial: {
        headline: resume.headline ?? "",
        summary: resume.summary ?? "",
        skills: skills.map((s) => s.skillName),
        entries: entries.map((e) => ({
          id: e.id,
          source: e.source as "manual" | "project",
          projectId: e.projectId,
          title: e.title,
          clientName: e.clientName ?? "",
          description: e.description ?? "",
          startDate: e.startDate ?? "",
          endDate: e.endDate ?? "",
          displayOrder: e.displayOrder,
        })),
        lastGeneratedPdfUrl,
      },
      aiImport: {
        byokConnected,
        byokKeyHint: connection?.apiKeyHint ?? null,
        remaining: quota ? quota.limit - quota.used : null,
        limit: DEFAULT_TIER_MONTHLY_LIMIT,
      },
    };
  });

  return <ResumeForm initial={initial} aiImport={aiImport} />;
}
