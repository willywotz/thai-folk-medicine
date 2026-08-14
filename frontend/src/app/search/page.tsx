import { EmptyState } from "@/components/EmptyState";
import { LinkRow } from "@/components/LinkRow";
import { SearchBox } from "@/components/SearchBox";
import { ApiError, search } from "@/lib/api";
import type { SearchResponse } from "@/lib/api-types";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ searchTerm?: string }>;
}) {
  const { searchTerm } = await searchParams;
  const term = (searchTerm ?? "").trim();

  let result: SearchResponse | null = null;
  let tooShort = false;
  if (term.length >= 2) {
    try {
      result = await search(term);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        tooShort = true;
      } else {
        throw err;
      }
    }
  } else if (term.length === 1) {
    tooShort = true;
  }

  const empty =
    result !== null &&
    result.remedies.length === 0 &&
    result.healers.length === 0 &&
    result.herbs.length === 0;

  return (
    <section>
      <h1 className="mb-4 font-serif text-2xl text-ink">ค้นหา (Search)</h1>
      <SearchBox defaultValue={term} />

      {tooShort ? (
        <p className="mt-4 text-sm text-ink-faint">
          พิมพ์อย่างน้อย 2 ตัวอักษร (type at least two characters).
        </p>
      ) : null}

      {empty ? (
        <div className="mt-6">
          <EmptyState message="No matches found." />
        </div>
      ) : null}

      {result !== null && !empty ? (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <h2 className="font-serif text-xl text-ink">
              ผลการค้นหา &ldquo;<span className="text-brand">{term}</span>&rdquo;
            </h2>
            <span className="text-sm text-ink-faint">
              พบ {result.herbs.length + result.remedies.length + result.healers.length} รายการ
            </span>
          </div>
          <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {result.herbs.map((h) => (
              <LinkRow
                key={`h${h.id}`}
                href={`/herbs/${h.id}`}
                icon="🌿"
                title={h.nameThai}
                subtitle={`สมุนไพร · ${h.scientificName}`}
                meta="สมุนไพร"
              />
            ))}
            {result.remedies.map((r) => (
              <LinkRow
                key={`r${r.id}`}
                href={`/remedies/${r.id}`}
                title={r.name}
                subtitle={`ตำรับยา · ${r.symptoms}`}
                meta="ตำรับยา"
              />
            ))}
            {result.healers.map((h) => (
              <LinkRow
                key={`he${h.id}`}
                href={`/healers/${h.id}`}
                icon="✚"
                title={h.fullName}
                subtitle={`หมอพื้นบ้าน · ${h.specialty}`}
                meta="หมอ"
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
