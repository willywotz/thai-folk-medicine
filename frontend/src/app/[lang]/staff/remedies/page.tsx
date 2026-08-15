import { RemedyAdminList } from "@/components/RemedyAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { listHealers } from "@/lib/api";

export default async function StaffRemediesPage() {
  const t = await getDictionary();
  // withinlazy: pageSize 48 caps the healer picker; add real staff pagination
  // if a province ever has more than 48 healers.
  const { items: healers } = await listHealers({ pageSize: 48 });

  return (
    <section>
      <StaffPageHeader eyebrow={t.staff.headers.remediesEyebrow} title={t.staff.headers.remedies} />
      <RemedyAdminList healers={healers} />
    </section>
  );
}
