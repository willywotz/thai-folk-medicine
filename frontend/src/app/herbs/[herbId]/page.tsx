import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/Breadcrumb";
import { DefinitionList } from "@/components/DefinitionList";
import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
import { getHerb, listRemediesByHerb } from "@/lib/api";

export default async function HerbPage({ params }: { params: Promise<{ herbId: string }> }) {
  const { herbId } = await params;
  const id = Number(herbId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const herb = await getHerb(id);
  if (!herb) notFound();
  const remedies = await listRemediesByHerb(id);

  return (
    <section>
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "สมุนไพร", href: "/herbs" },
          { label: herb.nameThai },
        ]}
      />
      <h1 className="text-2xl font-bold">{herb.nameThai}</h1>
      {herb.nameEnglish ? <p className="mt-1 text-stone-600">{herb.nameEnglish}</p> : null}
      <div className="mt-4">
        <DefinitionList
          items={[
            { term: "ชื่อวิทยาศาสตร์", value: herb.scientificName },
            { term: "สรรพคุณ", value: herb.properties },
            { term: "รายละเอียด", value: herb.description },
          ]}
        />
      </div>

      <h2 className="mb-3 mt-8 text-xl font-semibold">ตำรับยาที่ใช้สมุนไพรนี้ (Remedies using this herb)</h2>
      {remedies.length === 0 ? (
        <EmptyState message="No remedies use this herb yet." />
      ) : (
        <div className="grid gap-3">
          {remedies.map((r) => (
            <RecordCard key={r.id} href={`/remedies/${r.id}`} title={r.name} subtitle={r.symptoms} />
          ))}
        </div>
      )}
    </section>
  );
}
