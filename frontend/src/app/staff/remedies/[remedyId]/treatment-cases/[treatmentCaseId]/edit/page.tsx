import { notFound } from "next/navigation";

import { CaseForm } from "@/components/CaseForm";
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
      <h1 className="mb-4 text-xl font-bold">Edit treatment case</h1>
      <CaseForm remedyId={rId} healerId={remedy.healerId} treatmentCase={treatmentCase} />
    </section>
  );
}
