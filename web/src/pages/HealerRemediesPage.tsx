import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { NotFound } from "@/components/NotFound";
import { RemedyAdminList } from "@/components/RemedyAdminList";
import { Skeleton } from "@/components/Skeleton";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getHealer, listHealers } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

export function HealerRemediesPage() {
  const t = useT();
  const { lang = "th", healerId } = useParams();
  const id = Number(healerId);

  const valid = Number.isInteger(id) && id > 0;
  const healerQuery = useQuery({
    queryKey: ["healer", id],
    queryFn: () => getHealer(id),
    enabled: valid,
  });
  const healersQuery = useQuery({
    queryKey: ["healers-all"],
    queryFn: () => listHealers({ pageSize: 48 }),
  });

  if (!valid) return <NotFound />;
  if (healerQuery.isPending || healersQuery.isPending) return <Skeleton className="m-8 h-24" />;
  if (!healerQuery.data) return <NotFound />;

  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: t.staff.nav.dashboard, href: `/${lang}/staff` },
          { label: t.staff.headers.healers, href: `/${lang}/staff/healers` },
          { label: healerQuery.data.fullName },
        ]}
        title={t.staff.headers.healerRemedies}
      />
      <RemedyAdminList healers={healersQuery.data?.items ?? []} healerId={id} />
    </section>
  );
}
