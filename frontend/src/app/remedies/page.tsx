import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Filters } from "@/components/Filters";
import { Pagination } from "@/components/Pagination";
import { RecordCard } from "@/components/RecordCard";
import { firstPhotoUrl, getFirstProvince, listDistricts, listHerbs, listRemedies } from "@/lib/api";

export default async function RemediesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; herbId?: string; districtId?: string; symptom?: string }>;
}) {
  const { page: pageParam, herbId, districtId, symptom } = await searchParams;
  const page = Number(pageParam) || 1;

  const province = await getFirstProvince();
  const [herbOptions, districtOptions, remedyPage] = await Promise.all([
    listHerbs({ pageSize: 48 }).then((p) => p.items),
    province ? listDistricts(province.id) : Promise.resolve([]),
    listRemedies({
      page,
      herbId: herbId ? Number(herbId) : undefined,
      districtId: districtId ? Number(districtId) : undefined,
      symptom,
    }),
  ]);
  const remedies = remedyPage.items;
  const covers = await Promise.all(
    remedies.map((r) => firstPhotoUrl("remedy", r.id).catch(() => undefined)),
  );

  return (
    <section>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "ตำรับยา" }]} />
      <h1 className="mb-4 font-serif text-2xl text-ink">
        ตำรับยา <span className="text-base text-ink-faint">Remedies</span>
      </h1>
      <div className="mb-4">
        <Filters
          action="/remedies"
          fields={[
            {
              kind: "select",
              name: "herbId",
              label: "สมุนไพร",
              options: herbOptions.map((h) => ({ value: String(h.id), label: h.nameThai })),
            },
            {
              kind: "select",
              name: "districtId",
              label: "พื้นที่",
              options: districtOptions.map((d) => ({ value: String(d.id), label: d.nameThai })),
            },
            { kind: "text", name: "symptom", label: "อาการ", placeholder: "เช่น ไข้" },
          ]}
          values={{ herbId, districtId, symptom }}
        />
      </div>
      {remedies.length === 0 ? (
        <EmptyState message="No remedies yet." />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {remedies.map((r, i) => (
            <RecordCard
              key={r.id}
              href={`/remedies/${r.id}`}
              title={r.name}
              subtitle={r.symptoms}
              imageUrl={covers[i]}
            />
          ))}
        </div>
      )}
      <div className="mt-6">
        <Pagination
          page={remedyPage.page}
          totalPages={remedyPage.totalPages}
          searchParams={{ herbId, districtId, symptom, page: pageParam }}
          basePath="/remedies"
        />
      </div>
    </section>
  );
}
