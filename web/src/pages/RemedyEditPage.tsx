import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { NotFound } from "@/components/NotFound";
import { RemedyForm } from "@/components/RemedyForm";
import { Skeleton } from "@/components/Skeleton";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getRemedy, listHealers } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

export function RemedyEditPage() {
  const t = useT();
  const { lang = "th", remedyId } = useParams();
  const id = Number(remedyId);
  const enabled = Number.isInteger(id) && id > 0;

  const remedyQuery = useQuery({
    queryKey: ["remedy", id],
    queryFn: () => getRemedy(id),
    enabled,
  });
  // withinlazy: pageSize 48 caps the healer picker; add real staff pagination
  // if a province ever has more than 48 healers.
  const healersQuery = useQuery({
    queryKey: ["healers-all"],
    queryFn: () => listHealers({ pageSize: 48 }),
    enabled,
  });

  if (!enabled) return <NotFound />;
  if (remedyQuery.isPending || healersQuery.isPending) return <Skeleton className="m-8 h-24" />;
  if (remedyQuery.isError || healersQuery.isError) return <NotFound />;
  const remedy = remedyQuery.data;
  if (!remedy) return <NotFound />;

  const healerOptions = (healersQuery.data?.items ?? []).map((h) => ({
    value: h.id,
    label: h.fullName,
  }));
  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: t.staff.workspace, href: `/${lang}/staff` },
          { label: t.staff.headers.remedies, href: `/${lang}/staff/remedies` },
          { label: remedy.name },
        ]}
        eyebrow={t.staff.editRecord}
        title={t.staff.editName(remedy.name)}
      />
      <RemedyForm remedy={remedy} healerOptions={healerOptions} />
    </section>
  );
}
