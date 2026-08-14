import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/Breadcrumb";
import { DetailHeader } from "@/components/DetailHeader";
import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
import { SectionHead } from "@/components/SectionHead";
import { listDistricts, listHealersByDistrict, listProvinces } from "@/lib/api";

export default async function DistrictPage({
  params,
}: {
  params: Promise<{ districtId: string }>;
}) {
  const { districtId } = await params;
  const id = Number(districtId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const provinces = await listProvinces();
  const districtLists = await Promise.all(provinces.map((p) => listDistricts(p.id)));
  const district = districtLists.flat().find((d) => d.id === id);
  if (!district) notFound();
  const province = provinces.find((p) => p.id === district.provinceId);

  const healers = await listHealersByDistrict(id);

  return (
    <section>
      <Breadcrumb
        items={[
          { label: "หน้าแรก", href: "/" },
          { label: "พื้นที่", href: "/districts" },
          ...(province ? [{ label: province.nameThai, href: "/districts" }] : []),
          { label: district.nameThai },
        ]}
      />
      <DetailHeader
        titleThai={district.nameThai}
        subtitle={province ? `จังหวัด${province.nameThai}` : district.nameEnglish}
      />

      <SectionHead titleThai="หมอพื้นบ้านในพื้นที่นี้" titleEnglish="Healers" />
      {healers.length === 0 ? (
        <EmptyState message="No healers recorded in this district yet." />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
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
