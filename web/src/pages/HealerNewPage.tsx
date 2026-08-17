import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { HealerForm } from "@/components/HealerForm";
import { Skeleton } from "@/components/Skeleton";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getFirstProvince, listDistricts } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

export function HealerNewPage() {
  const t = useT();
  const { lang = "th" } = useParams();
  const { data: districtOptions, isPending } = useQuery({
    queryKey: ["healer-form-districts"],
    queryFn: async () => {
      const province = await getFirstProvince();
      const districts = province ? await listDistricts(province.id) : [];
      return districts.map((d) => ({ value: d.id, label: `${d.nameEnglish} · ${d.nameThai}` }));
    },
  });

  if (isPending) return <Skeleton className="m-8 h-24" />;

  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: t.staff.nav.dashboard, href: `/${lang}/staff` },
          { label: t.staff.headers.healers, href: `/${lang}/staff/healers` },
          { label: t.staff.newHealerCrumb },
        ]}
        eyebrow={t.staff.newRecord}
        title={t.staff.addHealerTitle}
      />
      <HealerForm districtOptions={districtOptions ?? []} />
    </section>
  );
}
