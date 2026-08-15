import { notFound } from "next/navigation";

import { HealerAdminList } from "@/components/HealerAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDistrict } from "@/lib/api";

export default async function StaffDistrictPage({
  params,
}: {
  params: Promise<{ districtId: string }>;
}) {
  const { districtId } = await params;
  const id = Number(districtId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const district = await getDistrict(id);
  if (!district) notFound();

  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: "Districts", href: "/staff" }, { label: district.nameThai }]}
        eyebrow={`${district.nameEnglish} · ${district.nameThai}`}
        title="Healers in this district"
      />
      <HealerAdminList districtId={id} />
    </section>
  );
}
