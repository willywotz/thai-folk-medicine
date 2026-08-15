import { notFound } from "next/navigation";

import { RemedyForm } from "@/components/RemedyForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getFirstProvince, getRemedy, listDistricts, listHealers } from "@/lib/api";

export default async function EditRemedyPage({
  params,
}: {
  params: Promise<{ remedyId: string }>;
}) {
  const { remedyId } = await params;
  const id = Number(remedyId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const remedy = await getRemedy(id);
  if (!remedy) notFound();
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
        crumbs={[{ label: "Remedies", href: "/staff/remedies" }, { label: remedy.name }]}
        eyebrow="edit record"
        title={`Edit ${remedy.name}`}
      />
      <RemedyForm remedy={remedy} healerOptions={healerOptions} />
    </section>
  );
}
