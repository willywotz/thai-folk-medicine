import { notFound } from "next/navigation";

import { CaseForm } from "@/components/CaseForm";
import { PhotoManager } from "@/components/PhotoManager";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getTreatmentCase, listRemedies } from "@/lib/api";

export default async function EditCasePage({
  params,
}: {
  params: Promise<{ treatmentCaseId: string }>;
}) {
  const { treatmentCaseId } = await params;
  const id = Number(treatmentCaseId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const treatmentCase = await getTreatmentCase(id);
  if (!treatmentCase) notFound();
  // withinlazy: pageSize 48 caps the remedy picker; add real staff pagination
  // if the catalog ever has more than 48 remedies.
  const { items: remedies } = await listRemedies({ pageSize: 48 });

  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: "Cases", href: "/staff/cases" }, { label: "Edit case" }]}
        eyebrow="edit record"
        title="Edit treatment case"
      />
      <CaseForm treatmentCase={treatmentCase} remedies={remedies} />
      <div className="mt-8">
        <PhotoManager ownerType="case" ownerId={treatmentCase.id} />
      </div>
    </section>
  );
}
