import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/Breadcrumb";
import { Callout } from "@/components/Callout";
import { ContentBlock } from "@/components/ContentBlock";
import { DetailHeader } from "@/components/DetailHeader";
import { EmptyState } from "@/components/EmptyState";
import { FactPanel } from "@/components/FactPanel";
import { Pagination } from "@/components/Pagination";
import { formatThaiDate, patientSexLabel } from "@/lib/format";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { firstPhotoUrl, getRemedy, listCasesByRemedy } from "@/lib/api";

export default async function RemedyPage({
  params,
  searchParams,
}: {
  params: Promise<{ remedyId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const t = await getDictionary();
  const { remedyId } = await params;
  const { page: pageParam } = await searchParams;
  const id = Number(remedyId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const page = Number(pageParam) || 1;

  const remedy = await getRemedy(id);
  if (!remedy) notFound();

  const [casePage, coverUrl] = await Promise.all([
    listCasesByRemedy(id, { page }),
    firstPhotoUrl("remedy", id).catch(() => undefined),
  ]);
  const cases = casePage.items;

  return (
    <section>
      <Breadcrumb
        items={[
          { label: t.common.home, href: "/" },
          { label: t.remedy.title },
          { label: remedy.name },
        ]}
      />
      <div className="grid items-start gap-8 md:grid-cols-[1fr_296px]">
        <div>
          <DetailHeader titleThai={remedy.name} editHref={`/staff/remedies/${remedy.id}/edit`} />

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
                    <a className="text-brand hover:underline" href={`/herbs/${h.herbId}`}>
                      {h.nameThai}
                    </a>
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
            <EmptyState message="No treatment cases recorded for this remedy yet." />
          ) : (
            <ul className="grid gap-3">
              {cases.map((c) => (
                <li key={c.id} className="rounded-2xl border border-line bg-surface p-4">
                  <p className="text-sm text-ink-faint">
                    {formatThaiDate(c.treatedOn)} · {patientSexLabel(c.patientSex)}, age {c.patientAge}
                  </p>
                  <p className="mt-1 text-ink">{c.symptoms}</p>
                  {c.result ? <p className="mt-1 text-sm text-ink-soft">{t.remedy.result(c.result)}</p> : null}
                  {c.note ? <p className="mt-1 text-sm text-ink-soft">{t.remedy.noteLine(c.note)}</p> : null}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Pagination
              page={casePage.page}
              totalPages={casePage.totalPages}
              searchParams={{ page: pageParam }}
              basePath={`/remedies/${id}`}
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
