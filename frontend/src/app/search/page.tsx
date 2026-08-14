import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
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
    result !== null && result.remedies.length === 0 && result.healers.length === 0;

  return (
    <section>
      <h1 className="mb-4 text-2xl font-bold">ค้นหา (Search)</h1>
      <SearchBox defaultValue={term} />

      {tooShort ? (
        <p className="mt-4 text-sm text-stone-500">
          พิมพ์อย่างน้อย 2 ตัวอักษร (type at least two characters).
        </p>
      ) : null}

      {empty ? (
        <div className="mt-6">
          <EmptyState message="No matches found." />
        </div>
      ) : null}

      {result !== null && result.remedies.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-3 text-xl font-semibold">ตำรับยา (Remedies)</h2>
          <div className="grid gap-3">
            {result.remedies.map((r) => (
              <RecordCard
                key={r.id}
                href={`/remedies/${r.id}`}
                title={r.name}
                subtitle={`${r.symptoms} · ${r.healerFullName}`}
              />
            ))}
          </div>
        </div>
      ) : null}

      {result !== null && result.healers.length > 0 ? (
        <div className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">หมอพื้นบ้าน (Healers)</h2>
          <div className="grid gap-3">
            {result.healers.map((h) => (
              <RecordCard
                key={h.id}
                href={`/healers/${h.id}`}
                title={h.fullName}
                subtitle={h.specialty}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
