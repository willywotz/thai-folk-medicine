import { notFound } from "next/navigation";

import { CaseAdminList } from "@/components/CaseAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getHealer, getRemedy } from "@/lib/api";

export default async function StaffCasesPage({
  params,
}: {
  params: Promise<{ remedyId: string }>;
}) {
  const { remedyId } = await params;
  const id = Number(remedyId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const remedy = await getRemedy(id);
  if (!remedy) notFound();
  const healer = await getHealer(remedy.healerId);

  const crumbs = [
    { label: "Districts", href: "/staff" },
    ...(healer
      ? [{ label: healer.fullName, href: `/staff/healers/${healer.id}/remedies` }]
      : []),
    { label: remedy.name },
  ];

  return (
    <section>
      <StaffPageHeader crumbs={crumbs} eyebrow={`Treatment cases for ${remedy.name}`} title="กรณีการรักษา · Cases" />
      <CaseAdminList remedyId={id} />
    </section>
  );
}
