import { notFound } from "next/navigation";

import { PhotoManager } from "@/components/PhotoManager";
import { RemedyForm } from "@/components/RemedyForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getRemedy, listHealers } from "@/lib/api";

export default async function EditRemedyPage({
  params,
}: {
  params: Promise<{ remedyId: string }>;
}) {
  const { remedyId } = await params;
  const id = Number(remedyId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const remedy = await getRemedy(id);
  if (!remedy) notFound();
  // withinlazy: pageSize 48 caps the healer picker; add real staff pagination
  // if a province ever has more than 48 healers.
  const { items: healers } = await listHealers({ pageSize: 48 });

  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: "Remedies", href: "/staff/remedies" }, { label: remedy.name }]}
        eyebrow="edit record"
        title={`Edit ${remedy.name}`}
      />
      <RemedyForm remedy={remedy} healers={healers} />
      <div className="mt-8">
        <PhotoManager ownerType="remedy" ownerId={remedy.id} />
      </div>
    </section>
  );
}
