import { notFound } from "next/navigation";

import { DistrictForm } from "@/components/DistrictForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { getProvince } from "@/lib/api";

export default async function NewDistrictPage({
  params,
}: {
  params: Promise<{ provinceId: string }>;
}) {
  const t = await getDictionary();
  const { provinceId } = await params;
  const id = Number(provinceId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const province = await getProvince(id);
  if (!province) notFound();
  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: t.staff.headers.provinces, href: "/staff/provinces" },
          { label: province.nameThai, href: `/staff/provinces/${id}` },
          { label: t.staff.newDistrictCrumb },
        ]}
        eyebrow={t.staff.headers.districtNew}
        title={t.staff.addDistrictTitle}
      />
      <DistrictForm provinceId={id} />
    </section>
  );
}
