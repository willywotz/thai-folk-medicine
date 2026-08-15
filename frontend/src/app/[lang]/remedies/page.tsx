import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { RecordCard } from "@/components/RecordCard";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { firstPhotoUrl, listRemedies } from "@/lib/api";

export default async function RemediesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const t = await getDictionary();
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;

  const remedyPage = await listRemedies({ page });
  const remedies = remedyPage.items;
  const covers = await Promise.all(
    remedies.map((r) => firstPhotoUrl("remedy", r.id).catch(() => undefined)),
  );

  return (
    <section>
      <Breadcrumb items={[{ label: t.common.home, href: "/" }, { label: t.remedy.title }]} />
      <h1 className="mb-4 font-serif text-2xl text-ink">{t.remedy.title}</h1>
      {remedies.length === 0 ? (
        <EmptyState message={t.home.noRemedies} />
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
          searchParams={{ page: pageParam }}
          basePath="/remedies"
        />
      </div>
    </section>
  );
}
