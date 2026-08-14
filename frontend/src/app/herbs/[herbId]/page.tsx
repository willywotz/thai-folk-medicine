import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/Breadcrumb";
import { ContentBlock } from "@/components/ContentBlock";
import { DetailHeader } from "@/components/DetailHeader";
import { EmptyState } from "@/components/EmptyState";
import { FactPanel } from "@/components/FactPanel";
import { LinkRow } from "@/components/LinkRow";
import { getHerb, listRemediesByHerb } from "@/lib/api";

export default async function HerbPage({ params }: { params: Promise<{ herbId: string }> }) {
  const { herbId } = await params;
  const id = Number(herbId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const herb = await getHerb(id);
  if (!herb) notFound();
  const remedies = await listRemediesByHerb(id);

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
          {herb.properties ? (
            <ContentBlock titleThai="สรรพคุณ" titleEnglish="Properties">
              {herb.properties}
            </ContentBlock>
          ) : null}
          {herb.description ? (
            <ContentBlock titleThai="ลักษณะและรายละเอียด" titleEnglish="Description">
              {herb.description}
            </ContentBlock>
          ) : null}

          <h2 className="mb-3 mt-8 font-serif text-lg text-ink">ตำรับยาที่ใช้สมุนไพรนี้</h2>
          {remedies.length === 0 ? (
            <EmptyState message="No remedies use this herb yet." />
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {remedies.map((r) => (
                <LinkRow key={r.id} href={`/remedies/${r.id}`} title={r.name} subtitle={r.symptoms} />
              ))}
            </div>
          )}
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
