import { notFound } from "next/navigation";

import { CaseForm } from "@/components/CaseForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getRemedy } from "@/lib/api";

export default async function NewCasePage({
  params,
}: {
  params: Promise<{ remedyId: string }>;
}) {
  const { remedyId } = await params;
  const id = Number(remedyId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const remedy = await getRemedy(id);
  if (!remedy) notFound();

  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: remedy.name, href: `/staff/remedies/${id}/treatment-cases` },
          { label: "New case" },
        ]}
        eyebrow="new record"
        title="Add a treatment case"
      />
      <CaseForm remedyId={id} healerId={remedy.healerId} />
    </section>
  );
}
