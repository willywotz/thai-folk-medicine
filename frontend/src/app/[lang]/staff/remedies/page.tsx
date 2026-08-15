import { RemedyAdminList } from "@/components/RemedyAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { listHealers } from "@/lib/api";

export default async function StaffRemediesPage() {
  // withinlazy: pageSize 48 caps the healer picker; add real staff pagination
  // if a province ever has more than 48 healers.
  const { items: healers } = await listHealers({ pageSize: 48 });

  return (
    <section>
      <StaffPageHeader eyebrow="ตำรับยา · folk remedies" title="Remedies" />
      <RemedyAdminList healers={healers} />
    </section>
  );
}
