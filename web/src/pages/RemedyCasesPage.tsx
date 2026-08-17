import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { CaseAdminList } from "@/components/CaseAdminList";
import { NotFound } from "@/components/NotFound";
import { Skeleton } from "@/components/Skeleton";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getRemedy, listRemedies } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

export function RemedyCasesPage() {
  const t = useT();
  const { lang = "th", remedyId } = useParams();
  const id = Number(remedyId);
  const enabled = Number.isInteger(id) && id > 0;

  const remedyQuery = useQuery({
    queryKey: ["remedy", id],
    queryFn: () => getRemedy(id),
    enabled,
  });
  // withinlazy: pageSize 48 caps the remedy-name lookup; add real staff pagination
  // if the catalog ever has more than 48 remedies.
  const remediesQuery = useQuery({
    queryKey: ["remedies-all"],
    queryFn: () => listRemedies({ pageSize: 48 }),
    enabled,
  });

  if (!enabled) return <NotFound />;
  if (remedyQuery.isPending || remediesQuery.isPending) return <Skeleton className="m-8 h-24" />;
  if (remedyQuery.isError || remediesQuery.isError) return <NotFound />;
  const remedy = remedyQuery.data;
  if (!remedy) return <NotFound />;

  const remedies = (remediesQuery.data?.items ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    healerId: r.healerId,
  }));
  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: t.staff.workspace, href: `/${lang}/staff` },
          { label: t.staff.headers.remedies, href: `/${lang}/staff/remedies` },
          { label: remedy.name },
        ]}
        title={t.staff.headers.remedyCases}
      />
      <CaseAdminList remedies={remedies} remedyId={id} />
    </section>
  );
}
