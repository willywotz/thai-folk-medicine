import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/Breadcrumb";
import { ContentBlock } from "@/components/ContentBlock";
import { EmptyState } from "@/components/EmptyState";
import { LinkRow } from "@/components/LinkRow";
import { Pagination } from "@/components/Pagination";
import { SectionHead } from "@/components/SectionHead";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { firstPhotoUrl, getHealer, listRemediesByHealer } from "@/lib/api";

export default async function HealerPage({
  params,
  searchParams,
}: {
  params: Promise<{ healerId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const t = await getDictionary();
  const { healerId } = await params;
  const { page: pageParam } = await searchParams;
  const id = Number(healerId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const page = Number(pageParam) || 1;

  const healer = await getHealer(id);
  if (!healer) notFound();

  const [remedyPage, avatarUrl] = await Promise.all([
    listRemediesByHealer(id, { page }),
    firstPhotoUrl("healer", id).catch(() => undefined),
  ]);
  const remedies = remedyPage.items;
  const remedyCovers = await Promise.all(
    remedies.map((r) => firstPhotoUrl("remedy", r.id).catch(() => undefined)),
  );

  return (
    <section>
      <Breadcrumb
        items={[
          { label: t.common.home, href: "/" },
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
        <EmptyState message="No remedies recorded for this healer yet." />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {remedies.map((r, i) => (
            <LinkRow
              key={r.id}
              href={`/remedies/${r.id}`}
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
          basePath={`/healers/${id}`}
        />
      </div>
    </section>
  );
}
