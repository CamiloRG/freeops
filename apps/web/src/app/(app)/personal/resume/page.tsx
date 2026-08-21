import { withUserDb } from "@/lib/db/rls";
import { getResumeFull } from "@/lib/services/resume";
import { getSignedDownloadUrl } from "@/lib/storage/r2";
import { ResumeForm } from "./resume-form";

export default async function ResumePage() {
  const initial = await withUserDb(async (tx, user) => {
    const { resume, entries, skills } = await getResumeFull(tx, user.id);
    const lastGeneratedPdfUrl = resume.lastGeneratedPdfKey
      ? await getSignedDownloadUrl("resumeExports", resume.lastGeneratedPdfKey)
      : null;
    return {
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
    };
  });

  return <ResumeForm initial={initial} />;
}
