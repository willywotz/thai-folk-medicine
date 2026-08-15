import { notFound } from "next/navigation";

import { DistrictForm } from "@/components/DistrictForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { getDistrict, getProvince } from "@/lib/api";

export default async function EditDistrictPage({
  params,
}: {
  params: Promise<{ provinceId: string; districtId: string }>;
}) {
  const t = await getDictionary();
  const { provinceId, districtId } = await params;
  const id = Number(provinceId);
  const districtIdNumber = Number(districtId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  if (!Number.isInteger(districtIdNumber) || districtIdNumber <= 0) notFound();
  const [province, district] = await Promise.all([getProvince(id), getDistrict(districtIdNumber)]);
  if (!province || !district || district.provinceId !== id) notFound();
  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: t.staff.nav.dashboard, href: "/staff" },
          { label: t.staff.headers.provinces, href: "/staff/provinces" },
          { label: province.nameThai, href: `/staff/provinces/${id}` },
          { label: district.nameThai },
        ]}
        eyebrow={t.staff.headers.districtEdit}
        title={t.staff.editName(district.nameThai)}
      />
      <DistrictForm provinceId={id} district={district} />
    </section>
  );
}
