import { RemedyForm } from "@/components/RemedyForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getFirstProvince, listDistricts, listHealers } from "@/lib/api";

export default async function NewRemedyPage({
  searchParams,
}: {
  searchParams: Promise<{ healerId?: string }>;
}) {
  const { healerId } = await searchParams;
  const defaultHealerId = healerId && Number.isInteger(Number(healerId)) ? Number(healerId) : undefined;
  // withinlazy: pageSize 48 caps the healer picker; add real staff pagination
  // if a province ever has more than 48 healers.
  const { items: healers } = await listHealers({ pageSize: 48 });
  const province = await getFirstProvince();
  const districts = province ? await listDistricts(province.id) : [];
  const districtName = (id: number) => districts.find((d) => d.id === id)?.nameThai ?? "—";
  const healerOptions = healers.map((h) => ({
    value: h.id,
    label: `${h.fullName} · ${districtName(h.districtId)} · ${province?.nameThai}`,
  }));

  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: "Remedies", href: "/staff/remedies" }, { label: "New remedy" }]}
        eyebrow="new record"
        title="Add a remedy"
      />
      <RemedyForm healerOptions={healerOptions} defaultHealerId={defaultHealerId} />
    </section>
  );
}
