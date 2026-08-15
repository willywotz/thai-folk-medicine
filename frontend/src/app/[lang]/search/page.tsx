import { EmptyState } from "@/components/EmptyState";
import { LinkRow } from "@/components/LinkRow";
import { Pagination } from "@/components/Pagination";
import { SearchBox } from "@/components/SearchBox";
import { ApiError, search } from "@/lib/api";
import type { Page, SearchHit } from "@/lib/api-types";

const TYPE_HREF: Record<SearchHit["type"], string> = {
  remedy: "/remedies",
  healer: "/healers",
  herb: "/herbs",
};

const TYPE_LABEL: Record<SearchHit["type"], string> = {
  remedy: "ตำรับยา",
  healer: "หมอ",
  herb: "สมุนไพร",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ searchTerm?: string; page?: string }>;
}) {
  const { searchTerm, page: pageParam } = await searchParams;
  const term = (searchTerm ?? "").trim();
  const page = Number(pageParam) || 1;

  let result: Page<SearchHit> | null = null;
  let tooShort = false;
  if (term.length >= 2) {
    try {
      result = await search(term, { page });
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

  const empty = result !== null && result.items.length === 0;

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
            <span className="text-sm text-ink-faint">พบ {result.total} รายการ</span>
          </div>
          <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {result.items.map((hit) => (
              <LinkRow
                key={`${hit.type}${hit.id}`}
                href={`${TYPE_HREF[hit.type]}/${hit.id}`}
                title={hit.title}
                subtitle={hit.subtitle}
                meta={TYPE_LABEL[hit.type]}
              />
            ))}
          </div>
          <div className="mt-6">
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              searchParams={{ searchTerm, page: pageParam }}
              basePath="/search"
            />
          </div>
        </>
      ) : null}
    </section>
  );
}
