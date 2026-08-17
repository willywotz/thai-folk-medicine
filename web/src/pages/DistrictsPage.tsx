import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { NotFound } from "@/components/NotFound";
import { RecordCard } from "@/components/RecordCard";
import { Skeleton } from "@/components/Skeleton";
import { getFirstProvince, getProvince, listDistricts } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

export function DistrictsPage() {
  const t = useT();
  const { lang = "th" } = useParams();
  const [sp] = useSearchParams();
  const id = Number(sp.get("provinceId"));
  const hasId = Number.isInteger(id) && id > 0;

  const { data, isPending } = useQuery({
    queryKey: ["districts", id],
    queryFn: async () => {
      const province = hasId ? await getProvince(id) : await getFirstProvince();
      if (!province) return { province: null, districts: [], hasId };
      const districts = await listDistricts(province.id);
      return { province, districts, hasId };
    },
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;
  const { province, districts, hasId: hadId } = data ?? {
    province: null,
    districts: [],
    hasId,
  };
  if (!province) {
    return hadId ? <NotFound /> : <EmptyState message={t.district.noData} />;
  }

  return (
    <section>
      <Breadcrumb items={[{ label: t.common.home, href: `/${lang}` }, { label: t.district.crumbList }]} />
      <h1 className="mb-1 font-serif text-2xl text-ink">{province.nameThai}</h1>
      <p className="mb-6 text-ink-soft">{t.district.intro}</p>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {districts.map((d) => (
          <RecordCard
            key={d.id}
            href={`/${lang}/districts/${d.id}`}
            title={d.nameThai}
            subtitle={d.nameEnglish}
          />
        ))}
      </div>
    </section>
  );
}
