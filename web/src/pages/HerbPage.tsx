import { useQuery } from "@tanstack/react-query";
import { Leaf } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { ContentBlock } from "@/components/ContentBlock";
import { DetailHeader } from "@/components/DetailHeader";
import { EmptyState } from "@/components/EmptyState";
import { FactPanel } from "@/components/FactPanel";
import { LinkRow } from "@/components/LinkRow";
import { NotFound } from "@/components/NotFound";
import { Pagination } from "@/components/Pagination";
import { Skeleton } from "@/components/Skeleton";
import { firstPhotoUrl, getHerb, listPhotosByOwner, listRemediesByHerb, photoUrl } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

export function HerbPage() {
  const t = useT();
  const { lang = "th", herbId } = useParams();
  const [sp] = useSearchParams();
  const pageParam = sp.get("page") ?? undefined;
  const page = Number(pageParam) || 1;
  const id = Number(herbId);

  const { data, isPending } = useQuery({
    queryKey: ["herb", id, page],
    enabled: Number.isInteger(id) && id > 0,
    queryFn: async () => {
      const herb = await getHerb(id);
      if (!herb) return null;
      const [remedyPage, photos] = await Promise.all([
        listRemediesByHerb(id, { page }),
        listPhotosByOwner("herb", id),
      ]);
      const remedies = remedyPage.items;
      const cover = photos[0];
      const remedyCovers = await Promise.all(
        remedies.map((r) => firstPhotoUrl("remedy", r.id).catch(() => undefined)),
      );
      return { herb, remedyPage, remedies, cover, remedyCovers };
    },
  });

  if (!Number.isInteger(id) || id <= 0) return <NotFound />;
  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (!data) return <NotFound />;
  const { herb, remedyPage, remedies, cover, remedyCovers } = data;

  return (
    <section>
      <Breadcrumb
        items={[
          { label: t.common.home, href: `/${lang}` },
          { label: t.herb.title, href: `/${lang}/herbs` },
          { label: herb.nameThai },
        ]}
      />
      <div className="grid items-start gap-8 md:grid-cols-[1fr_296px]">
        <div>
          <DetailHeader
            titleThai={herb.nameThai}
            subtitle={herb.nameEnglish}
            editHref={`/${lang}/staff/herbs/${herb.id}/edit`}
          />
          <div className="mt-4 grid aspect-[16/7] place-items-center overflow-hidden rounded-2xl border border-line bg-brand-tint text-brand">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element -- served by our own /api proxy, no next/image optimization needed
              <img
                src={photoUrl(cover.id)}
                alt={cover.caption || herb.nameThai}
                className="h-full w-full object-cover"
              />
            ) : (
              <Leaf className="h-14 w-14 opacity-80" aria-hidden />
            )}
          </div>
          {herb.properties ? (
            <ContentBlock title={t.herb.properties}>{herb.properties}</ContentBlock>
          ) : null}
          {herb.description ? (
            <ContentBlock title={t.herb.description}>{herb.description}</ContentBlock>
          ) : null}

          <h2 className="mb-3 mt-8 font-serif text-lg text-ink">{t.herb.usedIn}</h2>
          {remedies.length === 0 ? (
            <EmptyState message={t.herb.noRemedies} />
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {remedies.map((r, i) => (
                <LinkRow
                  key={r.id}
                  href={`/${lang}/remedies/${r.id}`}
                  title={r.name}
                  subtitle={r.symptoms}
                  imageUrl={remedyCovers[i]}
                />
              ))}
            </div>
          )}
          <div className="mt-4">
            <Pagination
              page={remedyPage.page}
              totalPages={remedyPage.totalPages}
              searchParams={{ page: pageParam }}
              basePath={`/${lang}/herbs/${id}`}
            />
          </div>
        </div>
        <aside className="md:sticky md:top-24">
          <FactPanel
            title={t.herb.quickFacts}
            facts={[{ key: t.herb.scientificName, value: herb.scientificName }]}
          />
        </aside>
      </div>
    </section>
  );
}
