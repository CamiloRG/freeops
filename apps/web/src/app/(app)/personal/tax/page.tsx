import { withUserDb } from "@/lib/db/rls";
import { getTaxInfoDecrypted, listTaxDocuments } from "@/lib/services/tax-info";
import { getSignedDownloadUrl } from "@/lib/storage/r2";
import { TaxInfoForm } from "./tax-info-form";

export default async function TaxInfoPage() {
  const { info, documents } = await withUserDb(async (tx, user) => {
    const info = await getTaxInfoDecrypted(tx, user.id);
    const docs = await listTaxDocuments(tx, user.id);
    const documents = await Promise.all(
      docs.map(async (doc) => ({
        id: doc.id,
        type: doc.documentType as "rut" | "camara_comercio" | "other",
        fileName: doc.fileName,
        fileUrl: await getSignedDownloadUrl("taxDocuments", doc.fileKey),
        uploadedAt: doc.uploadedAt.toISOString(),
      }))
    );
    return { info, documents };
  });

  return (
    <TaxInfoForm
      initial={
        info
          ? {
              taxIdType: info.taxIdType as "CC" | "NIT" | "CE" | "Pasaporte",
              taxIdNumber: info.taxIdNumber,
              taxRegime: info.taxRegime as "regimen_simple" | "regimen_ordinario" | "no_responsable" | null,
              isGranContribuyente: info.isGranContribuyente,
              isIvaResponsible: info.isIvaResponsible,
              ciiuCode: info.ciiuCode ?? "",
              fiscalAddress: info.fiscalAddress ?? "",
            }
          : null
      }
      documents={documents}
    />
  );
}
