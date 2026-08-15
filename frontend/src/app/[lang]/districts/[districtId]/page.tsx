import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/Breadcrumb";
import { DetailHeader } from "@/components/DetailHeader";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { RecordCard } from "@/components/RecordCard";
import { SectionHead } from "@/components/SectionHead";
import { listDistricts, listHealersByDistrict, listProvinces } from "@/lib/api";

export default async function DistrictPage({
  params,
  searchParams,
}: {
  params: Promise<{ districtId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { districtId } = await params;
  const { page: pageParam } = await searchParams;
  const id = Number(districtId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const page = Number(pageParam) || 1;

  const provinces = await listProvinces();
  const districtLists = await Promise.all(provinces.map((p) => listDistricts(p.id)));
  const district = districtLists.flat().find((d) => d.id === id);
  if (!district) notFound();
  const province = provinces.find((p) => p.id === district.provinceId);

  const healerPage = await listHealersByDistrict(id, { page });
  const healers = healerPage.items;

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
      <div className="mt-6">
        <Pagination
          page={healerPage.page}
          totalPages={healerPage.totalPages}
          searchParams={{ page: pageParam }}
          basePath={`/districts/${id}`}
        />
      </div>
    </section>
  );
}
