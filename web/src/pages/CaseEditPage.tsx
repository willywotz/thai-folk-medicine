import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { CaseForm } from "@/components/CaseForm";
import { NotFound } from "@/components/NotFound";
import { Skeleton } from "@/components/Skeleton";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getTreatmentCase, listRemedies } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

// withinlazy: pageSize 48 caps the remedy picker; add real staff pagination
// if the catalog ever has more than 48 remedies.
export function CaseEditPage() {
  const t = useT();
  const { lang = "th", treatmentCaseId } = useParams();
  const id = Number(treatmentCaseId);
  const enabled = Number.isInteger(id) && id > 0;

  const { data, isPending } = useQuery({
    queryKey: ["treatment-case-edit", id],
    enabled,
    queryFn: async () => {
      const treatmentCase = await getTreatmentCase(id);
      if (!treatmentCase) return null;
      const remedyPage = await listRemedies({ pageSize: 48 });
      return { treatmentCase, remedyPage };
    },
  });

  if (!enabled) return <NotFound />;
  if (isPending) return <Skeleton className="m-8 h-24" />;
  if (!data) return <NotFound />;

  const remedyOptions = data.remedyPage.items.map((r) => ({
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
          { label: t.staff.editCaseCrumb },
        ]}
        eyebrow={t.staff.editRecord}
        title={t.staff.editCaseTitle}
      />
      <CaseForm treatmentCase={data.treatmentCase} remedyOptions={remedyOptions} />
    </section>
  );
}
