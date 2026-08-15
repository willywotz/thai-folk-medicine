import { notFound } from "next/navigation";

import { DistrictAdminList } from "@/components/DistrictAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { getProvince } from "@/lib/api";

export default async function StaffProvincePage({
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
        crumbs={[{ label: t.staff.nav.dashboard, href: "/staff" }, { label: t.staff.headers.provinces, href: "/staff/provinces" }, { label: province.nameThai }]}
        eyebrow={`${province.nameEnglish} · ${province.nameThai}`}
        title={province.nameThai}
      />
      <DistrictAdminList provinceId={id} />
    </section>
  );
}
