import { CaseAdminList } from "@/components/CaseAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { listRemedies } from "@/lib/api";

export default async function StaffCasesPage() {
  const t = await getDictionary();
  // withinlazy: pageSize 48 caps the remedy picker; add real staff pagination
  // if the catalog ever has more than 48 remedies.
  const { items: remedies } = await listRemedies({ pageSize: 48 });

  return (
    <section>
      <StaffPageHeader eyebrow={t.staff.headers.casesEyebrow} title={t.staff.headers.cases} />
      <CaseAdminList remedies={remedies} />
    </section>
  );
}
