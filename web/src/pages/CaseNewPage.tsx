import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";

import { CaseForm } from "@/components/CaseForm";
import { Skeleton } from "@/components/Skeleton";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { listRemedies } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

// withinlazy: pageSize 48 caps the remedy picker; add real staff pagination
// if the catalog ever has more than 48 remedies.
export function CaseNewPage() {
  const t = useT();
  const { lang = "th" } = useParams();
  const [sp] = useSearchParams();
  const remedyIdParam = sp.get("remedyId") ?? undefined;
  const defaultRemedyId =
    remedyIdParam && Number.isInteger(Number(remedyIdParam)) ? Number(remedyIdParam) : undefined;

  const { data, isPending, isError } = useQuery({
    queryKey: ["remedies-all"],
    queryFn: () => listRemedies({ pageSize: 48 }),
  });

  if (isPending) return <Skeleton className="m-8 h-24" />;
  if (isError) return <p className="text-destructive">{t.staff.errorLoadRemedies}</p>;

  const remedyOptions = data.items.map((r) => ({
    value: r.id,
    label: r.name,
    healerId: r.healerId,
  }));

  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: t.staff.nav.dashboard, href: `/${lang}/staff` },
          { label: t.staff.crumbCases, href: `/${lang}/staff/cases` },
          { label: t.staff.newCaseCrumb },
        ]}
        eyebrow={t.staff.newRecord}
        title={t.staff.addCaseTitle}
      />
      <CaseForm remedyOptions={remedyOptions} defaultRemedyId={defaultRemedyId} />
    </section>
  );
}
