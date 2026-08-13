import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
import { getHealer, listRemediesByHealer } from "@/lib/api";

export default async function HealerPage({
  params,
}: {
  params: Promise<{ healerId: string }>;
}) {
  const { healerId } = await params;
  const id = Number(healerId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const healer = await getHealer(id);
  if (!healer) notFound();

  const remedies = await listRemediesByHealer(id);

  return (
    <section>
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "District", href: `/districts/${healer.districtId}` },
          { label: healer.fullName },
        ]}
      />
      <h1 className="text-2xl font-bold">{healer.fullName}</h1>
      {healer.specialty ? (
        <p className="mt-1 text-stone-600">ความชำนาญ: {healer.specialty}</p>
      ) : null}
      {healer.biography ? (
        <p className="mt-4 whitespace-pre-line text-stone-700">{healer.biography}</p>
      ) : null}

      <h2 className="mb-3 mt-8 text-xl font-semibold">Remedies (ตำรับยา)</h2>
      {remedies.length === 0 ? (
        <EmptyState message="No remedies recorded for this healer yet." />
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
