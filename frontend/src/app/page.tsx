import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
import { SearchBox } from "@/components/SearchBox";
import { formatThaiDate } from "@/lib/format";
import { listHerbs, listRecentCases, listRecentRemedies } from "@/lib/api";

export default async function HomePage() {
  const [herbs, remedies, cases] = await Promise.all([
    listHerbs(),
    listRecentRemedies(6),
    listRecentCases(6),
  ]);

  return (
    <section className="space-y-10">
      <div>
        <h1 className="mb-1 text-2xl font-bold">ตำรายาหมอพื้นบ้าน ยโสธร</h1>
        <p className="mb-4 text-stone-500">ค้นหาสมุนไพรและตำรับยา (search herbs and remedies)</p>
        <SearchBox />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">สมุนไพร (Herbs)</h2>
          <Link href="/herbs" className="text-sm text-stone-600 underline">
            see all →
          </Link>
        </div>
        {herbs.length === 0 ? (
          <EmptyState message="No herbs yet." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {herbs.slice(0, 6).map((h) => (
              <RecordCard key={h.id} href={`/herbs/${h.id}`} title={h.nameThai} subtitle={h.nameEnglish} />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">ตำรับยา (Remedies)</h2>
          <Link href="/remedies" className="text-sm text-stone-600 underline">
            see all →
          </Link>
        </div>
        {remedies.length === 0 ? (
          <EmptyState message="No remedies yet." />
        ) : (
          <div className="grid gap-3">
            {remedies.map((r) => (
              <RecordCard key={r.id} href={`/remedies/${r.id}`} title={r.name} subtitle={r.symptoms} />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">เคสการรักษา (Cases)</h2>
          <Link href="/treatment-cases" className="text-sm text-stone-600 underline">
            see all →
          </Link>
        </div>
        {cases.length === 0 ? (
          <EmptyState message="No cases yet." />
        ) : (
          <ul className="grid gap-3">
            {cases.map((c) => (
              <li key={c.id} className="rounded-lg border border-stone-200 bg-white p-4">
                <Link href={`/remedies/${c.remedyId}`} className="text-sm text-stone-700 hover:underline">
                  {formatThaiDate(c.treatedOn)} · {c.symptoms || "—"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-sm text-stone-500">
        <Link href="/districts" className="underline">
          เลือกตามอำเภอ (browse by district) →
        </Link>
      </p>
    </section>
  );
}
