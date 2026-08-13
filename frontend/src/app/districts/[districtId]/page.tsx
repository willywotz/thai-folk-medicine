import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
import { listHealersByDistrict } from "@/lib/api";

export default async function DistrictPage({
  params,
}: {
  params: Promise<{ districtId: string }>;
}) {
  const { districtId } = await params;
  const id = Number(districtId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const healers = await listHealersByDistrict(id);

  return (
    <section>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "District" }]} />
      <h1 className="mb-6 text-2xl font-bold">Healers (หมอพื้นบ้าน)</h1>
      {healers.length === 0 ? (
        <EmptyState message="No healers recorded in this district yet." />
      ) : (
        <div className="grid gap-3">
          {healers.map((h) => (
            <RecordCard
              key={h.id}
              href={`/healers/${h.id}`}
              title={h.fullName}
              subtitle={[h.specialty, h.subDistrict].filter(Boolean).join(" · ")}
            />
          ))}
        </div>
      )}
    </section>
  );
}
