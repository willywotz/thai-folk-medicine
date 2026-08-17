import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { RecordCard } from "@/components/RecordCard";
import { Skeleton } from "@/components/Skeleton";
import { firstPhotoUrl, listHerbs } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

export function HerbsPage() {
  const t = useT();
  const { lang = "th" } = useParams();
  const [sp] = useSearchParams();
  const pageParam = sp.get("page") ?? undefined;
  const page = Number(pageParam) || 1;

  const { data, isPending, isError } = useQuery({
    queryKey: ["herbs", page],
    queryFn: async () => {
      const herbPage = await listHerbs({ page });
      const herbs = herbPage.items;
      const covers = await Promise.all(
        herbs.map((h) => firstPhotoUrl("herb", h.id).catch(() => undefined)),
      );
      return { herbPage, herbs, covers };
    },
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (isError || !data) return <EmptyState message={t.home.noHerbs} />;
  const { herbPage, herbs, covers } = data;

  return (
    <section>
      <Breadcrumb items={[{ label: t.common.home, href: `/${lang}` }, { label: t.herb.title }]} />
      <h1 className="mb-4 font-serif text-2xl text-ink">{t.herb.title}</h1>
      {herbs.length === 0 ? (
        <EmptyState message={t.home.noHerbs} />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {herbs.map((h, i) => (
            <RecordCard
              key={h.id}
              href={`/${lang}/herbs/${h.id}`}
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
          basePath={`/${lang}/herbs`}
        />
      </div>
    </section>
  );
}
