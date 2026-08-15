import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { RecordCard } from "@/components/RecordCard";
import { firstPhotoUrl, listRemedies } from "@/lib/api";

export default async function RemediesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;

  const remedyPage = await listRemedies({ page });
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
          searchParams={{ page: pageParam }}
          basePath="/remedies"
        />
      </div>
    </section>
  );
}
