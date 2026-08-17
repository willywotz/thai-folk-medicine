import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { NotFound } from "@/components/NotFound";
import { RemedyAdminList } from "@/components/RemedyAdminList";
import { Skeleton } from "@/components/Skeleton";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { listHealers } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

export function StaffRemediesPage() {
  const t = useT();
  const { lang = "th" } = useParams();
  // withinlazy: pageSize 48 caps the healer picker; add real staff pagination
  // if a province ever has more than 48 healers.
  const { data, isPending, isError } = useQuery({
    queryKey: ["healers-all"],
    queryFn: () => listHealers({ pageSize: 48 }),
  });
  if (isPending) return <Skeleton className="m-8 h-24" />;
  if (isError || !data) return <NotFound />;

  const healers = data.items;
  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: t.staff.workspace, href: `/${lang}/staff` },
          { label: t.staff.headers.remedies },
        ]}
        eyebrow={t.staff.headers.remediesEyebrow}
        title={t.staff.headers.remedies}
      />
      <RemedyAdminList healers={healers} />
    </section>
  );
}
