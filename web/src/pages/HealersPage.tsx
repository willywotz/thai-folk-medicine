import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { HealerAdminList } from "@/components/HealerAdminList";
import { Skeleton } from "@/components/Skeleton";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getFirstProvince, listDistricts } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

export function HealersPage() {
  const t = useT();
  const { lang = "th" } = useParams();
  const { data: districts, isPending } = useQuery({
    queryKey: ["healers-page-districts"],
    queryFn: async () => {
      const province = await getFirstProvince();
      return province ? await listDistricts(province.id) : [];
    },
  });

  if (isPending) return <Skeleton className="m-8 h-24" />;

  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: t.staff.nav.dashboard, href: `/${lang}/staff` },
          { label: t.staff.headers.healers },
        ]}
        eyebrow={t.staff.headers.healersEyebrow}
        title={t.staff.headers.healers}
      />
      <HealerAdminList districts={districts ?? []} />
    </section>
  );
}
