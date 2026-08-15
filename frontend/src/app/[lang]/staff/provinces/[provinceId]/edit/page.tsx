import { notFound } from "next/navigation";

import { ProvinceForm } from "@/components/ProvinceForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { getProvince } from "@/lib/api";

export default async function EditProvincePage({
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
        crumbs={[{ label: t.staff.headers.provinces, href: "/staff/provinces" }, { label: province.nameThai }]}
        eyebrow={t.staff.headers.provinceEdit}
        title={t.staff.editName(province.nameThai)}
      />
      <ProvinceForm province={province} />
    </section>
  );
}
