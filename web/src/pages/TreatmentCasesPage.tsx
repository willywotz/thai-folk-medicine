import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { Skeleton } from "@/components/Skeleton";
import { formatThaiDate, patientSexLabel } from "@/lib/format";
import { useT } from "@/lib/i18n/useT";
import { listTreatmentCases } from "@/lib/api";

export function TreatmentCasesPage() {
  const t = useT();
  const { lang = "th" } = useParams();
  const [sp] = useSearchParams();
  const pageParam = sp.get("page") ?? undefined;
  const page = Number(pageParam) || 1;

  const { data, isPending, isError } = useQuery({
    queryKey: ["treatment-cases", page],
    queryFn: async () => {
      const casePage = await listTreatmentCases({ page });
      return {
        cases: casePage.items,
        page: casePage.page,
        totalPages: casePage.totalPages,
      };
    },
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;

  const cases = data?.cases ?? [];
  const renderEmpty = isError || cases.length === 0;

  return (
    <section>
      <Breadcrumb items={[{ label: t.common.home, href: `/${lang}` }, { label: t.case.crumb }]} />
      <h1 className="mb-4 text-2xl font-bold">{t.case.title}</h1>
      {renderEmpty ? (
        <EmptyState message={t.home.noCases} />
      ) : (
        <ul className="grid gap-3">
          {cases.map((c) => (
            <li key={c.id} className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="text-sm text-stone-500">
                {formatThaiDate(c.treatedOn)} · {patientSexLabel(c.patientSex)}, age {c.patientAge}
              </p>
              <p className="mt-1">{c.symptoms}</p>
              <Link to={`/${lang}/remedies/${c.remedyId}`} className="text-sm text-stone-700 underline">
                {t.case.viewRemedy}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6">
        <Pagination
          page={data?.page ?? 1}
          totalPages={data?.totalPages ?? 1}
          searchParams={{ page: pageParam }}
          basePath={`/${lang}/treatment-cases`}
        />
      </div>
    </section>
  );
}
