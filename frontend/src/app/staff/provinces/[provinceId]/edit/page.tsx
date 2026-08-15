import { notFound } from "next/navigation";

import { DistrictAdminList } from "@/components/DistrictAdminList";
import { ProvinceForm } from "@/components/ProvinceForm";
import { SectionHead } from "@/components/SectionHead";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getProvince } from "@/lib/api";

export default async function EditProvincePage({
  params,
}: {
  params: Promise<{ provinceId: string }>;
}) {
  const { provinceId } = await params;
  const id = Number(provinceId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const province = await getProvince(id);
  if (!province) notFound();
  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: "Provinces", href: "/staff/provinces" }, { label: province.nameThai }]}
        eyebrow="จังหวัด · edit record"
        title={`Edit ${province.nameThai}`}
      />
      <ProvinceForm province={province} />
      <SectionHead titleThai="อำเภอ" titleEnglish="Districts" />
      <DistrictAdminList provinceId={id} />
    </section>
  );
}
