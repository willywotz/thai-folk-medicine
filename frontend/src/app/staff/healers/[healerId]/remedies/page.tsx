import { notFound } from "next/navigation";

import { RemedyAdminList } from "@/components/RemedyAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getHealer, listHealers } from "@/lib/api";

export default async function HealerRemediesPage({
  params,
}: {
  params: Promise<{ healerId: string }>;
}) {
  const { healerId } = await params;
  const id = Number(healerId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const healer = await getHealer(id);
  if (!healer) notFound();
  // withinlazy: pageSize 48 caps the healer-name lookup; add real staff pagination
  // if a province ever has more than 48 healers.
  const { items: healers } = await listHealers({ pageSize: 48 });

  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: "Healers", href: "/staff/healers" }, { label: healer.fullName }]}
        title="ตำรับยา · Remedies"
      />
      <RemedyAdminList healers={healers} healerId={id} />
    </section>
  );
}
