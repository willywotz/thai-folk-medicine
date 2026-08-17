import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { DetailHeader } from "@/components/DetailHeader";
import { EmptyState } from "@/components/EmptyState";
import { NotFound } from "@/components/NotFound";
import { Pagination } from "@/components/Pagination";
import { RecordCard } from "@/components/RecordCard";
import { SectionHead } from "@/components/SectionHead";
import { Skeleton } from "@/components/Skeleton";
import type { District, Healer, Province } from "@/lib/api-types";
import { getDistrict, getProvince, listHealersByDistrict } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";
import type { Page } from "@/lib/api";

export function DistrictPage() {
  const t = useT();
  const { lang = "th", districtId } = useParams();
  const [sp] = useSearchParams();
  const pageParam = sp.get("page") ?? undefined;
  const page = Number(pageParam) || 1;
  const id = Number(districtId);

  const { data, isPending } = useQuery({
    queryKey: ["district", id, page],
    enabled: Number.isInteger(id) && id > 0,
    queryFn: async () => {
      // withinlazy: 2 reads (district + its province) replace the source's per-province fanout;
      // behavior identical for a valid id.
      const district = await getDistrict(id);
      if (!district) {
        return { district: null as District | null, province: null as Province | null, healerPage: null as Page<Healer> | null };
      }
      const [province, healerPage] = await Promise.all([
        getProvince(district.provinceId),
        listHealersByDistrict(id, { page }),
      ]);
      return { district, province, healerPage };
    },
  });

  if (!Number.isInteger(id) || id <= 0) return <NotFound />;
  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (!data?.district) return <NotFound />;

  const { district, province, healerPage } = data;
  const healers = healerPage?.items ?? [];

  return (
    <section>
      <Breadcrumb
        items={[
          { label: t.common.home, href: `/${lang}` },
          { label: t.district.crumbList, href: `/${lang}/districts` },
          ...(province ? [{ label: province.nameThai, href: `/${lang}/districts` }] : []),
          { label: district.nameThai },
        ]}
      />
      <DetailHeader
        titleThai={district.nameThai}
        subtitle={province ? t.district.provincePrefix(province.nameThai) : district.nameEnglish}
      />

      <SectionHead title={t.district.healers} />
      {healers.length === 0 ? (
        <EmptyState message={t.district.noHealers} />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {healers.map((h) => (
            <RecordCard
              key={h.id}
              href={`/${lang}/healers/${h.id}`}
              title={h.fullName}
              subtitle={[h.specialty, h.subDistrict].filter(Boolean).join(" · ")}
            />
          ))}
        </div>
      )}
      <div className="mt-6">
        <Pagination
          page={healerPage?.page ?? 1}
          totalPages={healerPage?.totalPages ?? 1}
          searchParams={{ page: pageParam }}
          basePath={`/${lang}/districts/${id}`}
        />
      </div>
    </section>
  );
}
