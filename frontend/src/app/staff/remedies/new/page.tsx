import { RemedyForm } from "@/components/RemedyForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { listHealers } from "@/lib/api";

export default async function NewRemedyPage() {
  // withinlazy: pageSize 48 caps the healer picker; add real staff pagination
  // if a province ever has more than 48 healers.
  const { items: healers } = await listHealers({ pageSize: 48 });

  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: "Remedies", href: "/staff/remedies" }, { label: "New remedy" }]}
        eyebrow="new record"
        title="Add a remedy"
      />
      <RemedyForm healers={healers} />
    </section>
  );
}
