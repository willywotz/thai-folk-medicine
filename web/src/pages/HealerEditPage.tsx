import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { HealerForm } from "@/components/HealerForm";
import { NotFound } from "@/components/NotFound";
import { Skeleton } from "@/components/Skeleton";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getFirstProvince, getHealer, listDistricts } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

export function HealerEditPage() {
  const t = useT();
  const { lang = "th", healerId } = useParams();
  const id = Number(healerId);

  const valid = Number.isInteger(id) && id > 0;
  const healerQuery = useQuery({
    queryKey: ["healer", id],
    queryFn: () => getHealer(id),
    enabled: valid,
  });
  const districtsQuery = useQuery({
    queryKey: ["healer-form-districts"],
    queryFn: async () => {
      const province = await getFirstProvince();
      const districts = province ? await listDistricts(province.id) : [];
      return districts.map((d) => ({ value: d.id, label: `${d.nameEnglish} · ${d.nameThai}` }));
    },
  });

  if (!valid) return <NotFound />;
  if (healerQuery.isPending || districtsQuery.isPending) return <Skeleton className="m-8 h-24" />;
  if (!healerQuery.data) return <NotFound />;

  const healer = healerQuery.data;

  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: t.staff.nav.dashboard, href: `/${lang}/staff` },
          { label: t.staff.headers.healers, href: `/${lang}/staff/healers` },
          { label: healer.fullName },
        ]}
        eyebrow={t.staff.editRecord}
        title={t.staff.editName(healer.fullName)}
      />
      <HealerForm healer={healer} districtOptions={districtsQuery.data ?? []} />
    </section>
  );
}
