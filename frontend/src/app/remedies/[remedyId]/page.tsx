import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/Breadcrumb";
import { DefinitionList } from "@/components/DefinitionList";
import { EmptyState } from "@/components/EmptyState";
import { formatThaiDate, patientSexLabel } from "@/lib/format";
import { getRemedy, listCasesByRemedy } from "@/lib/api";

export default async function RemedyPage({
  params,
}: {
  params: Promise<{ remedyId: string }>;
}) {
  const { remedyId } = await params;
  const id = Number(remedyId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const remedy = await getRemedy(id);
  if (!remedy) notFound();

  const cases = await listCasesByRemedy(id);

  return (
    <section>
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Healer", href: `/healers/${remedy.healerId}` },
          { label: remedy.name },
        ]}
      />
      <h1 className="mb-4 text-2xl font-bold">{remedy.name}</h1>

      <h2 className="mb-2 text-lg font-semibold">ตัวยา (Herbs)</h2>
      {remedy.herbs.length === 0 ? (
        <p className="text-stone-500">—</p>
      ) : (
        <ul className="mb-6 grid gap-2">
          {remedy.herbs.map((h) => (
            <li key={h.herbId}>
              <Link href={`/herbs/${h.herbId}`} className="text-stone-800 underline">
                {h.nameThai}
              </Link>
              {h.amount ? <span className="text-stone-500"> · {h.amount}</span> : null}
            </li>
          ))}
        </ul>
      )}

      <DefinitionList
        items={[
          { term: "สรรพคุณ", value: remedy.symptoms },
          { term: "วิธีปรุง", value: remedy.preparationMethod },
          { term: "วิธีใช้", value: remedy.usage },
          { term: "หมายเหตุ", value: remedy.note },
        ]}
      />

      <h2 className="mb-3 mt-8 text-xl font-semibold">Treatment cases (เคสการรักษา)</h2>
      {cases.length === 0 ? (
        <EmptyState message="No treatment cases recorded for this remedy yet." />
      ) : (
        <ul className="grid gap-3">
          {cases.map((c) => (
            <li key={c.id} className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="text-sm text-stone-500">
                {formatThaiDate(c.treatedOn)} · {patientSexLabel(c.patientSex)}, age {c.patientAge}
              </p>
              <DefinitionList
                items={[
                  { term: "อาการ", value: c.symptoms },
                  { term: "ผลการรักษา", value: c.result },
                  { term: "หมายเหตุ", value: c.note },
                ]}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
