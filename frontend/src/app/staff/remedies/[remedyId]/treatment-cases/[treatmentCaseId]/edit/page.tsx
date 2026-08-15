import { notFound } from "next/navigation";

import { CaseForm } from "@/components/CaseForm";
import { PhotoManager } from "@/components/PhotoManager";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getRemedy, getTreatmentCase } from "@/lib/api";

export default async function EditCasePage({
  params,
}: {
  params: Promise<{ remedyId: string; treatmentCaseId: string }>;
}) {
  const { remedyId, treatmentCaseId } = await params;
  const rId = Number(remedyId);
  const cId = Number(treatmentCaseId);
  if (!Number.isInteger(rId) || rId <= 0 || !Number.isInteger(cId) || cId <= 0) notFound();

  const remedy = await getRemedy(rId);
  if (!remedy) notFound();
  const treatmentCase = await getTreatmentCase(cId);
  if (!treatmentCase) notFound();

  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: remedy.name, href: `/staff/remedies/${rId}/treatment-cases` },
          { label: "Edit case" },
        ]}
        eyebrow="edit record"
        title="Edit treatment case"
      />
      <CaseForm remedyId={rId} healerId={remedy.healerId} treatmentCase={treatmentCase} />
      <div className="mt-8">
        <PhotoManager ownerType="case" ownerId={treatmentCase.id} />
      </div>
    </section>
  );
}
