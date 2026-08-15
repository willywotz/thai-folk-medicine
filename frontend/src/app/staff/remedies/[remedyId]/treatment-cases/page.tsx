import { notFound } from "next/navigation";

import { CaseAdminList } from "@/components/CaseAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getRemedy, listRemedies } from "@/lib/api";

export default async function RemedyTreatmentCasesPage({
  params,
}: {
  params: Promise<{ remedyId: string }>;
}) {
  const { remedyId } = await params;
  const id = Number(remedyId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const remedy = await getRemedy(id);
  if (!remedy) notFound();
  // withinlazy: pageSize 48 caps the remedy-name lookup; add real staff pagination
  // if the catalog ever has more than 48 remedies.
  const { items: remedies } = await listRemedies({ pageSize: 48 });

  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: "Remedies", href: "/staff/remedies" }, { label: remedy.name }]}
        title="กรณีการรักษา · Cases"
      />
      <CaseAdminList remedies={remedies} remedyId={id} />
    </section>
  );
}
