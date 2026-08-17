import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { HerbForm } from "@/components/HerbForm";
import { NotFound } from "@/components/NotFound";
import { Skeleton } from "@/components/Skeleton";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getHerb } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

export function HerbEditPage() {
  const t = useT();
  const { lang = "th", herbId } = useParams();
  const id = Number(herbId);

  const { data: herb, isPending } = useQuery({
    queryKey: ["herb", id],
    enabled: Number.isInteger(id) && id > 0,
    queryFn: () => getHerb(id),
  });

  if (!Number.isInteger(id) || id <= 0) return <NotFound />;
  if (isPending) return <Skeleton className="m-8 h-24" />;
  if (!herb) return <NotFound />;

  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: t.staff.nav.dashboard, href: `/${lang}/staff` },
          { label: t.staff.crumbHerbs, href: `/${lang}/staff/herbs` },
          { label: herb.nameThai },
        ]}
        eyebrow={t.staff.headers.herbEdit}
        title={t.staff.editName(herb.nameThai)}
      />
      <HerbForm herb={herb} />
    </section>
  );
}
