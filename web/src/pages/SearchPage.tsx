import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { LinkRow } from "@/components/LinkRow";
import { Pagination } from "@/components/Pagination";
import { SearchBox } from "@/components/SearchBox";
import { Skeleton } from "@/components/Skeleton";
import { ApiError, search } from "@/lib/api";
import type { Page, SearchHit } from "@/lib/api-types";
import { useT } from "@/lib/i18n/useT";

const TYPE_HREF: Record<SearchHit["type"], string> = {
  remedy: "/remedies",
  healer: "/healers",
  herb: "/herbs",
};

export function SearchPage() {
  const t = useT();
  const { lang = "th" } = useParams();
  const [sp] = useSearchParams();
  const term = (sp.get("searchTerm") ?? "").trim();
  const page = Number(sp.get("page")) || 1;

  const typeLabel: Record<SearchHit["type"], string> = {
    remedy: t.search.kindRemedy,
    healer: t.search.kindHealer,
    herb: t.search.kindHerb,
  };

  const { data, isPending } = useQuery({
    queryKey: ["search", term, page],
    enabled: term.length >= 2,
    queryFn: async () => {
      try {
        return { result: await search(term, { page }), tooShort: false };
      } catch (err) {
        if (err instanceof ApiError && err.status === 400) {
          return { result: null, tooShort: true };
        }
        throw err;
      }
    },
  });

  const tooShort = term.length === 1 || data?.tooShort === true;
  const result: Page<SearchHit> | null = data?.result ?? null;
  const empty = result !== null && result.items.length === 0;

  return (
    <section>
      <Breadcrumb items={[{ label: t.common.home, href: `/${lang}` }, { label: t.common.search }]} />
      <h1 className="mb-4 font-serif text-2xl text-ink">{t.search.title}</h1>
      <SearchBox key={term} defaultValue={term} />

      {tooShort ? <p className="mt-4 text-sm text-ink-faint">{t.search.minChars}</p> : null}

      {empty ? (
        <div className="mt-6">
          <EmptyState message={t.search.noMatches} />
        </div>
      ) : null}

      {term.length >= 2 && isPending ? <Skeleton className="mt-6 h-40 w-full" /> : null}

      {result !== null && !empty ? (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <h2 className="font-serif text-xl text-ink">
              {t.search.resultsFor} &ldquo;<span className="text-brand">{term}</span>&rdquo;
            </h2>
            <span className="text-sm text-ink-faint">{t.search.found(result.total)}</span>
          </div>
          <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {result.items.map((hit) => (
              <LinkRow
                key={`${hit.type}${hit.id}`}
                href={`/${lang}${TYPE_HREF[hit.type]}/${hit.id}`}
                title={hit.title}
                subtitle={hit.subtitle}
                meta={typeLabel[hit.type]}
              />
            ))}
          </div>
          <div className="mt-6">
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              searchParams={{ searchTerm: term, page: sp.get("page") ?? undefined }}
              basePath={`/${lang}/search`}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}
