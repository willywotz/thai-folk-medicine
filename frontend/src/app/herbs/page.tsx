import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Filters } from "@/components/Filters";
import { Pagination } from "@/components/Pagination";
import { RecordCard } from "@/components/RecordCard";
import { firstPhotoUrl, listHerbs } from "@/lib/api";

export default async function HerbsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; query?: string }>;
}) {
  const { page: pageParam, query } = await searchParams;
  const page = Number(pageParam) || 1;

  const herbPage = await listHerbs({ page, query });
  const herbs = herbPage.items;
  const covers = await Promise.all(
    herbs.map((h) => firstPhotoUrl("herb", h.id).catch(() => undefined)),
  );
  return (
    <section>
      <Breadcrumb items={[{ label: "หน้าแรก", href: "/" }, { label: "สมุนไพร" }]} />
      <h1 className="mb-4 font-serif text-2xl text-ink">
        สมุนไพร <span className="text-base text-ink-faint">Herbs</span>
      </h1>
      <div className="mb-4">
        <Filters
          action="/herbs"
          fields={[{ kind: "text", name: "query", label: "ค้นหาสมุนไพร", placeholder: "ชื่อสมุนไพร" }]}
          values={{ query }}
        />
      </div>
      {herbs.length === 0 ? (
        <EmptyState message="No herbs yet." />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {herbs.map((h, i) => (
            <RecordCard
              key={h.id}
              href={`/herbs/${h.id}`}
              title={h.nameThai}
              subtitle={h.nameEnglish}
              imageUrl={covers[i]}
            />
          ))}
        </div>
      )}
      <div className="mt-6">
        <Pagination
          page={herbPage.page}
          totalPages={herbPage.totalPages}
          searchParams={{ query, page: pageParam }}
          basePath="/herbs"
        />
      </div>
    </section>
  );
}
