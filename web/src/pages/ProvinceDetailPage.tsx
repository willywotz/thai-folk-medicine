import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { DistrictAdminList } from "@/components/DistrictAdminList";
import { NotFound } from "@/components/NotFound";
import { Skeleton } from "@/components/Skeleton";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getProvince } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

export function ProvinceDetailPage() {
  const t = useT();
  const { lang = "th", provinceId } = useParams();
  const id = Number(provinceId);

  const { data: province, isPending } = useQuery({
    queryKey: ["province", id],
    enabled: Number.isInteger(id) && id > 0,
    queryFn: () => getProvince(id),
  });

  if (!Number.isInteger(id) || id <= 0) return <NotFound />;
  if (isPending) return <Skeleton className="m-8 h-24" />;
  if (!province) return <NotFound />;

  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: t.staff.nav.dashboard, href: `/${lang}/staff` },
          { label: t.staff.headers.provinces, href: `/${lang}/staff/provinces` },
          { label: province.nameThai },
        ]}
        eyebrow={`${province.nameEnglish} · ${province.nameThai}`}
        title={province.nameThai}
      />
      <DistrictAdminList provinceId={id} />
    </section>
  );
}
