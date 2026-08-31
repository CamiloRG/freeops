import { withUserDb } from "@/lib/db/rls";
import { listWithholdingCertificates } from "@/lib/services/withholding-certificates";
import { serializeWithholdingCertificate } from "@/lib/services/withholding-view";
import { listProjects } from "@/lib/services/projects";
import { getSignedDownloadUrl } from "@/lib/storage/r2";
import { WithholdingCertificateList } from "./withholding-certificate-list";

export default async function WithholdingCertificatesPage() {
  const { rows, projects } = await withUserDb(async (tx, user) => {
    const [rows, projects] = await Promise.all([
      listWithholdingCertificates(tx, user.id, {}),
      listProjects(tx, user.id, {}),
    ]);
    return { rows, projects };
  });

  const items = await Promise.all(
    rows.map(async (row) => {
      const s = serializeWithholdingCertificate(row);
      return {
        ...s,
        fileUrl: row.fileKey ? await getSignedDownloadUrl("withholdingCertificates", row.fileKey) : null,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      };
    })
  );
  const projectOptions = projects.map((p) => ({ id: p.id, title: p.title, clientName: p.clientName }));

  return <WithholdingCertificateList initialItems={items} projectOptions={projectOptions} />;
}
