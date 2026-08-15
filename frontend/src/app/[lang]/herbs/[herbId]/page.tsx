import { Leaf } from "lucide-react";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/Breadcrumb";
import { ContentBlock } from "@/components/ContentBlock";
import { DetailHeader } from "@/components/DetailHeader";
import { EmptyState } from "@/components/EmptyState";
import { FactPanel } from "@/components/FactPanel";
import { LinkRow } from "@/components/LinkRow";
import { Pagination } from "@/components/Pagination";
import { firstPhotoUrl, getHerb, listPhotosByOwner, listRemediesByHerb, photoUrl } from "@/lib/api";

export default async function HerbPage({
  params,
  searchParams,
}: {
  params: Promise<{ herbId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { herbId } = await params;
  const { page: pageParam } = await searchParams;
  const id = Number(herbId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const page = Number(pageParam) || 1;

  const herb = await getHerb(id);
  if (!herb) notFound();
  const [remedyPage, photos] = await Promise.all([
    listRemediesByHerb(id, { page }),
    listPhotosByOwner("herb", id),
  ]);
  const remedies = remedyPage.items;
  const cover = photos[0];
  const remedyCovers = await Promise.all(
    remedies.map((r) => firstPhotoUrl("remedy", r.id).catch(() => undefined)),
  );

  return (
    <section>
      <Breadcrumb
        items={[
          { label: "หน้าแรก", href: "/" },
          { label: "สมุนไพร", href: "/herbs" },
          { label: herb.nameThai },
        ]}
      />
      <div className="grid items-start gap-8 md:grid-cols-[1fr_296px]">
        <div>
          <DetailHeader
            titleThai={herb.nameThai}
            subtitle={herb.nameEnglish}
            editHref={`/staff/herbs/${herb.id}/edit`}
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
            <ContentBlock title="สรรพคุณ">{herb.properties}</ContentBlock>
          ) : null}
          {herb.description ? (
            <ContentBlock title="ลักษณะและรายละเอียด">{herb.description}</ContentBlock>
          ) : null}

          <h2 className="mb-3 mt-8 font-serif text-lg text-ink">ตำรับยาที่ใช้สมุนไพรนี้</h2>
          {remedies.length === 0 ? (
            <EmptyState message="No remedies use this herb yet." />
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
          <div className="mt-4">
            <Pagination
              page={remedyPage.page}
              totalPages={remedyPage.totalPages}
              searchParams={{ page: pageParam }}
              basePath={`/herbs/${id}`}
            />
          </div>
        </div>
        <aside className="md:sticky md:top-24">
          <FactPanel
            title="ข้อมูลสมุนไพร · Quick facts"
            facts={[{ key: "ชื่อวิทยาศาสตร์", value: herb.scientificName }]}
          />
        </aside>
      </div>
    </section>
  );
}
