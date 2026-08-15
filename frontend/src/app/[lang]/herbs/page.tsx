import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { RecordCard } from "@/components/RecordCard";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { firstPhotoUrl, listHerbs } from "@/lib/api";

export default async function HerbsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const t = await getDictionary();
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;

  const herbPage = await listHerbs({ page });
  const herbs = herbPage.items;
  const covers = await Promise.all(
    herbs.map((h) => firstPhotoUrl("herb", h.id).catch(() => undefined)),
  );
  return (
    <section>
      <Breadcrumb items={[{ label: t.common.home, href: "/" }, { label: t.herb.title }]} />
      <h1 className="mb-4 font-serif text-2xl text-ink">{t.herb.title}</h1>
      {herbs.length === 0 ? (
        <EmptyState message={t.home.noHerbs} />
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
          searchParams={{ page: pageParam }}
          basePath="/herbs"
        />
      </div>
    </section>
  );
}
