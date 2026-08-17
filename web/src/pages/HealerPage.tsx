import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { ContentBlock } from "@/components/ContentBlock";
import { EmptyState } from "@/components/EmptyState";
import { LinkRow } from "@/components/LinkRow";
import { NotFound } from "@/components/NotFound";
import { Pagination } from "@/components/Pagination";
import { SectionHead } from "@/components/SectionHead";
import { Skeleton } from "@/components/Skeleton";
import { firstPhotoUrl, getHealer, listRemediesByHealer } from "@/lib/api";
import { useT } from "@/lib/i18n/useT";

export function HealerPage() {
  const t = useT();
  const { lang = "th", healerId } = useParams();
  const [sp] = useSearchParams();
  const pageParam = sp.get("page") ?? undefined;
  const page = Number(pageParam) || 1;
  const id = Number(healerId);

  const { data, isPending } = useQuery({
    queryKey: ["healer", id, page],
    enabled: Number.isInteger(id) && id > 0,
    queryFn: async () => {
      const healer = await getHealer(id);
      if (!healer) return { healer: null, remedyPage: null, remedyCovers: null };

      const [remedyPage, avatarUrl] = await Promise.all([
        listRemediesByHealer(id, { page }),
        firstPhotoUrl("healer", id).catch(() => undefined),
      ]);
      const remedies = remedyPage.items;
      const remedyCovers = await Promise.all(
        remedies.map((r) => firstPhotoUrl("remedy", r.id).catch(() => undefined)),
      );
      return { healer, remedyPage, remedyCovers, avatarUrl };
    },
  });

  if (!Number.isInteger(id) || id <= 0) return <NotFound />;
  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (!data?.healer) return <NotFound />;

  const { healer, remedyPage, remedyCovers, avatarUrl } = data;
  const remedies = remedyPage.items;

  return (
    <section>
      <Breadcrumb
        items={[
          { label: t.common.home, href: `/${lang}` },
          { label: t.healer.crumb },
          { label: healer.fullName },
        ]}
      />
      <div className="flex flex-wrap items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- served by our own /api proxy, no next/image optimization needed
          <img
            src={avatarUrl}
            alt={healer.fullName}
            className="h-16 w-16 rounded-full border border-brand object-cover"
          />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-full border border-brand bg-brand-tint font-serif text-2xl text-brand-strong">
            {healer.fullName.slice(0, 1)}
          </span>
        )}
        <div>
          <h1 className="font-serif text-2xl text-ink">{healer.fullName}</h1>
          <p className="text-ink-soft">
            {[healer.specialty, healer.subDistrict].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      {healer.biography ? (
        <ContentBlock title={t.healer.biography}>{healer.biography}</ContentBlock>
      ) : null}

      <SectionHead title={t.healer.remedies} />
      {remedies.length === 0 ? (
        <EmptyState message={t.healer.noRemedies} />
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
      <div className="mt-6">
        <Pagination
          page={remedyPage.page}
          totalPages={remedyPage.totalPages}
          searchParams={{ page: pageParam }}
          basePath={`/${lang}/healers/${id}`}
        />
      </div>
    </section>
  );
}
