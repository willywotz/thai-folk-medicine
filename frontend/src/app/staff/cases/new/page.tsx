import { CaseForm } from "@/components/CaseForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getFirstProvince, listDistricts, listHealers, listRemedies } from "@/lib/api";

export default async function NewCasePage() {
  // withinlazy: pageSize 48 caps the remedy picker; add real staff pagination
  // if the catalog ever has more than 48 remedies.
  const { items: remedies } = await listRemedies({ pageSize: 48 });
  // withinlazy: pageSize 48 caps the healer lookup; add real staff pagination
  // if a province ever has more than 48 healers.
  const { items: healers } = await listHealers({ pageSize: 48 });
  const province = await getFirstProvince();
  const districts = province ? await listDistricts(province.id) : [];
  const districtName = (id: number) => districts.find((d) => d.id === id)?.nameThai ?? "—";
  const healerName = (id: number) => healers.find((h) => h.id === id)?.fullName ?? "—";
  const remedyOptions = remedies.map((r) => {
    const healer = healers.find((h) => h.id === r.healerId);
    return {
      value: r.id,
      label: `${r.name} · ${healerName(r.healerId)} · ${healer ? districtName(healer.districtId) : "—"} · ${province?.nameThai}`,
      healerId: r.healerId,
    };
  });

  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: "Cases", href: "/staff/cases" }, { label: "New case" }]}
        eyebrow="new record"
        title="Add a treatment case"
      />
      <CaseForm remedyOptions={remedyOptions} />
    </section>
  );
}
