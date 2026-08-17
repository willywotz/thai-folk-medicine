import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { DistrictForm } from "@/components/DistrictForm";
import { NotFound } from "@/components/NotFound";
import { Skeleton } from "@/components/Skeleton";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDistrict, getProvince } from "@/lib/api";
import type { District, Province } from "@/lib/api-types";
import { useT } from "@/lib/i18n/useT";

export function DistrictEditPage() {
  const t = useT();
  const { lang = "th", provinceId, districtId } = useParams();
  const id = Number(provinceId);
  const districtIdNumber = Number(districtId);

  const enabled = Number.isInteger(id) && id > 0 && Number.isInteger(districtIdNumber) && districtIdNumber > 0;

  const { data, isPending } = useQuery({
    queryKey: ["province-district", id, districtIdNumber],
    enabled,
    queryFn: async () => {
      const [province, district] = await Promise.all([getProvince(id), getDistrict(districtIdNumber)]);
      return { province, district };
    },
  });

  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(districtIdNumber) || districtIdNumber <= 0) {
    return <NotFound />;
  }
  if (isPending) return <Skeleton className="m-8 h-24" />;
  const province = data?.province as Province | null | undefined;
  const district = data?.district as District | null | undefined;
  if (!province || !district || district.provinceId !== id) return <NotFound />;

  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: t.staff.nav.dashboard, href: `/${lang}/staff` },
          { label: t.staff.headers.provinces, href: `/${lang}/staff/provinces` },
          { label: province.nameThai, href: `/${lang}/staff/provinces/${id}` },
          { label: district.nameThai },
        ]}
        eyebrow={t.staff.headers.districtEdit}
        title={t.staff.editName(district.nameThai)}
      />
      <DistrictForm provinceId={id} district={district} />
    </section>
  );
}
