import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { Callout } from "@/components/Callout";
import { ContentBlock } from "@/components/ContentBlock";
import { DetailHeader } from "@/components/DetailHeader";
import { EmptyState } from "@/components/EmptyState";
import { FactPanel } from "@/components/FactPanel";
import { NotFound } from "@/components/NotFound";
import { Pagination } from "@/components/Pagination";
import { Skeleton } from "@/components/Skeleton";
import { firstPhotoUrl, getRemedy, listCasesByRemedy } from "@/lib/api";
import { formatThaiDate, patientSexLabel } from "@/lib/format";
import { useT } from "@/lib/i18n/useT";

export function RemedyPage() {
  const t = useT();
  const { lang = "th", remedyId } = useParams();
  const [sp] = useSearchParams();
  const pageParam = sp.get("page") ?? undefined;
  const id = Number(remedyId);
  const page = Number(pageParam) || 1;

  const { data, isPending } = useQuery({
    queryKey: ["remedy", id, page],
    queryFn: async () => {
      const remedy = await getRemedy(id);
      if (!remedy) return { remedy: null };
      const [casePage, coverUrl] = await Promise.all([
        listCasesByRemedy(id, { page }),
        firstPhotoUrl("remedy", id).catch(() => undefined),
      ]);
      return { remedy, casePage, coverUrl };
    },
    enabled: Number.isInteger(id) && id > 0,
  });

  if (!Number.isInteger(id) || id <= 0) return <NotFound />;
  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (!data?.remedy) return <NotFound />;

  const { remedy, casePage, coverUrl } = data;
  const cases = casePage.items;

  return (
    <section>
      <Breadcrumb
        items={[
          { label: t.common.home, href: `/${lang}` },
          { label: t.remedy.title, href: `/${lang}/remedies` },
          { label: remedy.name },
        ]}
      />
      <div className="grid items-start gap-8 md:grid-cols-[1fr_296px]">
        <div>
          <DetailHeader
            titleThai={remedy.name}
            editHref={`/${lang}/staff/remedies/${remedy.id}/edit`}
          />

          {coverUrl ? (
            <div className="mt-4 aspect-[16/7] overflow-hidden rounded-2xl border border-line bg-brand-tint">
              {/* eslint-disable-next-line @next/next/no-img-element -- served by our own /api proxy, no next/image optimization needed */}
              <img src={coverUrl} alt={remedy.name} className="h-full w-full object-cover" />
            </div>
          ) : null}

          <ContentBlock title={t.remedy.symptoms}>{remedy.symptoms}</ContentBlock>

          <ContentBlock title={t.remedy.ingredients}>
            {remedy.herbs.length === 0 ? (
              "—"
            ) : (
              <ul className="ml-4 list-disc">
                {remedy.herbs.map((h) => (
                  <li key={h.herbId}>
                    <Link
                      className="text-brand hover:underline"
                      to={`/${lang}/herbs/${h.herbId}`}
                    >
                      {h.nameThai}
                    </Link>
                    {h.amount ? ` — ${h.amount}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </ContentBlock>

          {remedy.preparationMethod || remedy.usage ? (
            <ContentBlock title={t.remedy.preparation}>
              {[remedy.preparationMethod, remedy.usage].filter(Boolean).join("\n\n")}
            </ContentBlock>
          ) : null}

          {remedy.note ? (
            <Callout variant="caution">
              <b>{t.remedy.note}:</b> {remedy.note}
            </Callout>
          ) : null}

          <h2 className="mb-3 mt-8 font-serif text-lg text-ink">{t.remedy.treatmentCases}</h2>
          {cases.length === 0 ? (
            <EmptyState message={t.remedy.noCases} />
          ) : (
            <ul className="grid gap-3">
              {cases.map((c) => (
                <li key={c.id} className="rounded-2xl border border-line bg-surface p-4">
                  <p className="text-sm text-ink-faint">
                    {formatThaiDate(c.treatedOn)} · {patientSexLabel(c.patientSex)}, age {c.patientAge}
                  </p>
                  <p className="mt-1 text-ink">{c.symptoms}</p>
                  {c.result ? (
                    <p className="mt-1 text-sm text-ink-soft">{t.remedy.result(c.result)}</p>
                  ) : null}
                  {c.note ? (
                    <p className="mt-1 text-sm text-ink-soft">{t.remedy.noteLine(c.note)}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Pagination
              page={casePage.page}
              totalPages={casePage.totalPages}
              searchParams={{ page: pageParam }}
              basePath={`/${lang}/remedies/${id}`}
            />
          </div>
        </div>
        <aside className="md:sticky md:top-24">
          <FactPanel
            title={t.remedy.quickFacts}
            facts={[{ key: t.remedy.symptoms, value: remedy.symptoms }]}
          />
        </aside>
      </div>
    </section>
  );
}
