/**
 * Resume / CV Builder — app_spec.md § "API Contracts & Integrations" → "3.
 * Resume / CV builder".
 *
 * `syncProjects` pulls completed `projects` rows into `resume_entries`
 * (`source: "project"`), matched/re-synced by `project_id` so re-running is
 * idempotent (update in place, never duplicate) — per the contract's
 * explicit "Idempotent — re-running re-syncs rather than duplicating
 * entries" requirement. Business/Projects (Phase 5) has no
 * project-creation UI yet, so this correctly returns an empty list today;
 * that's expected, not a bug.
 *
 * `exportPdf` renders a real PDF (via `pdfkit`) and uploads it to R2's
 * `resume-exports` bucket. Spec deviation: the contract's
 * `POST /resume/export` → `202 { jobId }` / `GET /export/:jobId` shape
 * implies a background-job queue, but no queue-backed worker exists yet
 * (the spec's own "Background jobs" integration is introduced in a later
 * phase, not this one) — generation runs synchronously inside the POST
 * handler instead. The async contract shape is preserved (the route still
 * returns `202 { jobId }` and a pollable `GET .../export/:jobId`), it just
 * always resolves `"done"` immediately since there's no real queue yet;
 * flagged in this phase's report.
 */
import { and, eq, isNull } from "drizzle-orm";
import { projects, resumeEntries, resumeSkills, resumes } from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";
import type { ResumeUpdateInput } from "@/lib/validation/personal";
import PDFDocument from "pdfkit";

/** Race-safe find-or-create — see `@/lib/services/profile`'s `getOrCreateProfile` doc comment for why. */
export async function getOrCreateResume(tx: RlsTx, userId: string) {
  const [inserted] = await tx
    .insert(resumes)
    .values({ userId })
    .onConflictDoNothing({ target: resumes.userId })
    .returning();
  if (inserted) return inserted;

  const existing = await tx.query.resumes.findFirst({ where: eq(resumes.userId, userId) });
  if (existing) return existing;
  throw new Error("getOrCreateResume: insert conflicted but no existing row was found.");
}

export async function getResumeFull(tx: RlsTx, userId: string) {
  const resume = await getOrCreateResume(tx, userId);
  const entries = await tx.query.resumeEntries.findMany({
    where: and(eq(resumeEntries.resumeId, resume.id), isNull(resumeEntries.deletedAt)),
    orderBy: (t, { asc }) => [asc(t.displayOrder)],
  });
  const skills = await tx.query.resumeSkills.findMany({
    where: eq(resumeSkills.resumeId, resume.id),
  });
  return { resume, entries, skills };
}

/**
 * `PUT /me/resume` semantics: replaces the whole manual-editable surface
 * (headline, summary, skills, entries) in one call. `source: "project"`
 * entries are included in the replace set too (the client echoes back
 * whatever `sync-projects` last gave it, possibly hand-edited) — this
 * function doesn't distinguish source, it just persists whatever entry
 * list the client sends, same as the API contract's `sections` body shape.
 */
export async function replaceResume(tx: RlsTx, userId: string, input: ResumeUpdateInput) {
  const resume = await getOrCreateResume(tx, userId);

  await tx
    .update(resumes)
    .set({
      headline: input.headline ?? null,
      summary: input.summary ?? null,
      updatedAt: new Date(),
    })
    .where(eq(resumes.id, resume.id));

  // Replace skills wholesale (small list, simplest to reason about).
  await tx.delete(resumeSkills).where(eq(resumeSkills.resumeId, resume.id));
  if (input.skills.length > 0) {
    await tx.insert(resumeSkills).values(input.skills.map((skillName) => ({ resumeId: resume.id, skillName })));
  }

  // Replace entries wholesale too, except we preserve `source`/`projectId`
  // as given by the client rather than re-deriving them.
  await tx.delete(resumeEntries).where(eq(resumeEntries.resumeId, resume.id));
  if (input.entries.length > 0) {
    await tx.insert(resumeEntries).values(
      input.entries.map((entry, index) => ({
        resumeId: resume.id,
        source: entry.source,
        projectId: entry.projectId ?? null,
        title: entry.title,
        clientName: entry.clientName || null,
        description: entry.description || null,
        startDate: entry.startDate || null,
        endDate: entry.endDate || null,
        displayOrder: entry.displayOrder ?? index,
      }))
    );
  }

  return getResumeFull(tx, userId);
}

export async function syncProjectsIntoResume(tx: RlsTx, userId: string, projectIds?: string[]) {
  const resume = await getOrCreateResume(tx, userId);

  const completedProjects = await tx.query.projects.findMany({
    where: and(
      eq(projects.userId, userId),
      eq(projects.status, "completed"),
      isNull(projects.deletedAt)
    ),
  });
  const filtered = projectIds?.length
    ? completedProjects.filter((p) => projectIds.includes(p.id))
    : completedProjects;

  const existingEntries = await tx.query.resumeEntries.findMany({
    where: eq(resumeEntries.resumeId, resume.id),
  });
  const existingByProjectId = new Map(
    existingEntries.filter((e) => e.projectId).map((e) => [e.projectId as string, e])
  );

  for (const project of filtered) {
    const match = existingByProjectId.get(project.id);
    const values = {
      title: project.title,
      clientName: project.clientName,
      description: project.description,
      startDate: project.startDate,
      endDate: project.endDate,
    };
    if (match) {
      await tx
        .update(resumeEntries)
        .set({ ...values, updatedAt: new Date(), deletedAt: null })
        .where(eq(resumeEntries.id, match.id));
    } else {
      await tx.insert(resumeEntries).values({
        resumeId: resume.id,
        source: "project",
        projectId: project.id,
        ...values,
      });
    }
  }

  return getResumeFull(tx, userId);
}

/** Renders a simple, real PDF from the resume's current content — no headless browser needed. */
export function renderResumePdf(params: {
  fullName: string;
  headline: string | null;
  summary: string | null;
  skills: string[];
  entries: { title: string; clientName: string | null; description: string | null; startDate: string | null; endDate: string | null }[];
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(22).text(params.fullName, { align: "left" });
    if (params.headline) {
      doc.fontSize(13).fillColor("#6C5CE7").text(params.headline);
    }
    doc.fillColor("#000000").moveDown();

    if (params.summary) {
      doc.fontSize(11).text(params.summary, { align: "left" });
      doc.moveDown();
    }

    if (params.skills.length > 0) {
      doc.fontSize(14).text("Skills", { underline: true });
      doc.fontSize(11).text(params.skills.join(" · "));
      doc.moveDown();
    }

    if (params.entries.length > 0) {
      doc.fontSize(14).text("Experience", { underline: true });
      doc.moveDown(0.5);
      for (const entry of params.entries) {
        doc.fontSize(12).text(entry.title, { continued: false });
        const dateRange = [entry.startDate, entry.endDate].filter(Boolean).join(" – ");
        const subtitle = [entry.clientName, dateRange].filter(Boolean).join(" · ");
        if (subtitle) doc.fontSize(10).fillColor("#555555").text(subtitle);
        doc.fillColor("#000000");
        if (entry.description) doc.fontSize(10).text(entry.description);
        doc.moveDown();
      }
    }

    doc.end();
  });
}

export async function setLastGeneratedPdfKey(tx: RlsTx, userId: string, key: string) {
  const resume = await getOrCreateResume(tx, userId);
  await tx
    .update(resumes)
    .set({ lastGeneratedPdfKey: key, updatedAt: new Date() })
    .where(eq(resumes.id, resume.id));
}
