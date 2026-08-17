import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";

import { NotFound } from "@/components/NotFound";
import { RemedyForm } from "@/components/RemedyForm";
import { Skeleton } from "@/components/Skeleton";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { listHealers } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

export function RemedyNewPage() {
  const t = useT();
  const { lang = "th" } = useParams();
  const [sp] = useSearchParams();
  const healerIdParam = sp.get("healerId");
  const parsed = healerIdParam ? Number(healerIdParam) : NaN;
  const defaultHealerId = Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;

  // withinlazy: pageSize 48 caps the healer picker; add real staff pagination
  // if a province ever has more than 48 healers.
  const { data, isPending, isError } = useQuery({
    queryKey: ["healers-all"],
    queryFn: () => listHealers({ pageSize: 48 }),
  });
  if (isPending) return <Skeleton className="m-8 h-24" />;
  if (isError || !data) return <NotFound />;

  const healerOptions = data.items.map((h) => ({ value: h.id, label: h.fullName }));
  return (
    <section>
      <StaffPageHeader
        crumbs={[
          { label: t.staff.workspace, href: `/${lang}/staff` },
          { label: t.staff.headers.remedies, href: `/${lang}/staff/remedies` },
          { label: t.staff.newRemedyCrumb },
        ]}
        eyebrow={t.staff.newRecord}
        title={t.staff.addRemedyTitle}
      />
      <RemedyForm healerOptions={healerOptions} defaultHealerId={defaultHealerId} />
    </section>
  );
}
