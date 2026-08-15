import { CaseAdminList } from "@/components/CaseAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { listRemedies } from "@/lib/api";

export default async function StaffCasesPage() {
  // withinlazy: pageSize 48 caps the remedy picker; add real staff pagination
  // if the catalog ever has more than 48 remedies.
  const { items: remedies } = await listRemedies({ pageSize: 48 });

  return (
    <section>
      <StaffPageHeader eyebrow="กรณีการรักษา · cases" title="Treatment cases" />
      <CaseAdminList remedies={remedies} />
    </section>
  );
}
