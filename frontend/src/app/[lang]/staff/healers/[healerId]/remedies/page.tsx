import { notFound } from "next/navigation";

import { RemedyAdminList } from "@/components/RemedyAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { getHealer, listHealers } from "@/lib/api";

export default async function HealerRemediesPage({
  params,
}: {
  params: Promise<{ healerId: string }>;
}) {
  const t = await getDictionary();
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
        crumbs={[{ label: t.staff.headers.healers, href: "/staff/healers" }, { label: healer.fullName }]}
        title={t.staff.headers.healerRemedies}
      />
      <RemedyAdminList healers={healers} healerId={id} />
    </section>
  );
}
