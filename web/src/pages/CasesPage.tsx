import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { CaseAdminList } from "@/components/CaseAdminList";
import { Skeleton } from "@/components/Skeleton";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { listRemedies } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

// withinlazy: pageSize 48 caps the remedy picker; add real staff pagination
// if the catalog ever has more than 48 remedies.
export function CasesPage() {
  const t = useT();
  const { lang = "th" } = useParams();
  const { data, isPending, isError } = useQuery({
    queryKey: ["remedies-all"],
    queryFn: () => listRemedies({ pageSize: 48 }),
  });

  if (isPending) return <Skeleton className="m-8 h-24" />;
  if (isError) return <p className="text-destructive">{t.staff.errorLoadRemedies}</p>;

  const remedies = data.items.map((r) => ({ id: r.id, name: r.name, healerId: r.healerId }));

  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: t.staff.nav.dashboard, href: `/${lang}/staff` },
          { label: t.staff.crumbCases },
        ]}
        eyebrow={t.staff.headers.casesEyebrow}
        title={t.staff.headers.cases}
      />
      <CaseAdminList remedies={remedies} />
    </section>
  );
}
