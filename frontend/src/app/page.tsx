import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { LinkRow } from "@/components/LinkRow";
import { RecordCard } from "@/components/RecordCard";
import { SearchBox } from "@/components/SearchBox";
import { SectionHead } from "@/components/SectionHead";
import { formatThaiDate } from "@/lib/format";
import { listHerbs, listProvinces, listRecentCases, listRecentRemedies } from "@/lib/api";

export default async function HomePage() {
  const [herbs, remedies, cases, provinces] = await Promise.all([
    listHerbs(),
    listRecentRemedies(6),
    listRecentCases(6),
    listProvinces(),
  ]);

  return (
    <section>
      <div className="py-8 text-center">
        <h1 className="mb-1.5 font-serif text-3xl text-ink">ค้นหาสมุนไพรและตำรับยาพื้นบ้าน</h1>
        <p className="mb-5 text-ink-soft">Folk herbs, remedies, and healers — recorded from local wisdom</p>
        <div className="mx-auto max-w-xl">
          <SearchBox />
        </div>
      </div>

      <SectionHead titleThai="สมุนไพร" titleEnglish="Herbs" href="/herbs" />
      {herbs.length === 0 ? (
        <EmptyState message="No herbs yet." />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {herbs.slice(0, 4).map((h) => (
            <RecordCard key={h.id} href={`/herbs/${h.id}`} title={h.nameThai} subtitle={h.nameEnglish} />
          ))}
        </div>
      )}

      <SectionHead titleThai="ตำรับยา" titleEnglish="Remedies" href="/remedies" />
      {remedies.length === 0 ? (
        <EmptyState message="No remedies yet." />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {remedies.map((r) => (
            <LinkRow key={r.id} href={`/remedies/${r.id}`} title={r.name} subtitle={r.symptoms} />
          ))}
        </div>
      )}

      <SectionHead titleThai="เคสการรักษาล่าสุด" titleEnglish="Recent cases" />
      {cases.length === 0 ? (
        <EmptyState message="No cases yet." />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {cases.map((c) => (
            <LinkRow
              key={c.id}
              href={`/remedies/${c.remedyId}`}
              icon="✚"
              title={c.symptoms || "—"}
              subtitle={`รักษาด้วยตำรับ #${c.remedyId}`}
              meta={formatThaiDate(c.treatedOn)}
            />
          ))}
        </div>
      )}

      {provinces.length > 0 ? (
        <>
          <SectionHead titleThai="เลือกตามพื้นที่" titleEnglish="By area" href="/districts" />
          <div className="flex flex-wrap gap-2">
            {provinces.map((p) => (
              <Chip key={p.id} href="/districts">
                {p.nameThai}
              </Chip>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
