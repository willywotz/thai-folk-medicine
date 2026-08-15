import { CaseForm } from "@/components/CaseForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { listRemedies } from "@/lib/api";

export default async function NewCasePage() {
  // withinlazy: pageSize 48 caps the remedy picker; add real staff pagination
  // if the catalog ever has more than 48 remedies.
  const { items: remedies } = await listRemedies({ pageSize: 48 });

  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: "Cases", href: "/staff/cases" }, { label: "New case" }]}
        eyebrow="new record"
        title="Add a treatment case"
      />
      <CaseForm remedies={remedies} />
    </section>
  );
}
