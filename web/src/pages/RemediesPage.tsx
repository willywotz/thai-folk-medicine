import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { RecordCard } from "@/components/RecordCard";
import { Skeleton } from "@/components/Skeleton";
import { firstPhotoUrl, listRemedies } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

export function RemediesPage() {
  const t = useT();
  const { lang = "th" } = useParams();
  const [sp] = useSearchParams();
  const pageParam = sp.get("page") ?? undefined;
  const page = Number(pageParam) || 1;

  const { data, isPending, isError } = useQuery({
    queryKey: ["remedies", page],
    queryFn: async () => {
      const remedyPage = await listRemedies({ page });
      const remedies = remedyPage.items;
      const covers = await Promise.all(
        remedies.map((r) => firstPhotoUrl("remedy", r.id).catch(() => undefined)),
      );
      return { remedyPage, remedies, covers };
    },
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (isError || !data) return <EmptyState message={t.home.noRemedies} />;

  const { remedyPage, remedies, covers } = data;

  return (
    <section>
      <Breadcrumb items={[{ label: t.common.home, href: `/${lang}` }, { label: t.remedy.title }]} />
      <h1 className="mb-4 font-serif text-2xl text-ink">{t.remedy.title}</h1>
      {remedies.length === 0 ? (
        <EmptyState message={t.home.noRemedies} />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {remedies.map((r, i) => (
            <RecordCard
              key={r.id}
              href={`/${lang}/remedies/${r.id}`}
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
          basePath={`/${lang}/remedies`}
        />
      </div>
    </section>
  );
}
