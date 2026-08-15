import Link from "next/link";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { formatThaiDate, patientSexLabel } from "@/lib/format";
import { listTreatmentCases } from "@/lib/api";

export default async function TreatmentCasesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;

  const casePage = await listTreatmentCases({ page });
  const cases = casePage.items;
  return (
    <section>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "เคสการรักษา" }]} />
      <h1 className="mb-4 text-2xl font-bold">เคสการรักษา (Cases)</h1>
      {cases.length === 0 ? (
        <EmptyState message="No cases yet." />
      ) : (
        <ul className="grid gap-3">
          {cases.map((c) => (
            <li key={c.id} className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="text-sm text-stone-500">
                {formatThaiDate(c.treatedOn)} · {patientSexLabel(c.patientSex)}, age {c.patientAge}
              </p>
              <p className="mt-1">{c.symptoms}</p>
              <Link href={`/remedies/${c.remedyId}`} className="text-sm text-stone-700 underline">
                ดูตำรับยา (view remedy) →
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6">
        <Pagination
          page={casePage.page}
          totalPages={casePage.totalPages}
          searchParams={{ page: pageParam }}
          basePath="/treatment-cases"
        />
      </div>
    </section>
  );
}
