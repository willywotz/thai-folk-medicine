import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { LinkRow } from "@/components/LinkRow";
import { RecordCard } from "@/components/RecordCard";
import { SearchBox } from "@/components/SearchBox";
import { SectionHead } from "@/components/SectionHead";
import { Skeleton } from "@/components/Skeleton";
import { formatThaiDate } from "@/lib/format";
import { useT } from "@/lib/i18n/useT";
import { firstPhotoUrl, listHerbs, listProvinces, listRemedies, listTreatmentCases } from "@/lib/api";

export function HomePage() {
  const t = useT();
  const { lang = "th" } = useParams();

  const { data, isPending } = useQuery({
    queryKey: ["home"],
    queryFn: async () => {
      const [herbPage, remedyPage, casePage, provinces] = await Promise.all([
        listHerbs({ pageSize: 4 }),
        listRemedies({ pageSize: 6 }),
        listTreatmentCases({ pageSize: 6 }),
        listProvinces(),
      ]);
      const shownHerbs = herbPage.items;
      const remedies = remedyPage.items;
      const cases = casePage.items;
      const [herbCovers, remedyCovers, caseCovers] = await Promise.all([
        Promise.all(shownHerbs.map((h) => firstPhotoUrl("herb", h.id).catch(() => undefined))),
        Promise.all(remedies.map((r) => firstPhotoUrl("remedy", r.id).catch(() => undefined))),
        Promise.all(cases.map((c) => firstPhotoUrl("remedy", c.remedyId).catch(() => undefined))),
      ]);
      return { shownHerbs, remedies, cases, provinces, herbCovers, remedyCovers, caseCovers };
    },
  });

  if (isPending) return <Skeleton className="h-96 w-full" />;
  const { shownHerbs, remedies, cases, provinces, herbCovers, remedyCovers, caseCovers } = data!;

  return (
    <section>
      <div className="py-8 text-center">
        <h1 className="mb-1.5 font-serif text-3xl text-ink">{t.home.heroTitle}</h1>
        <p className="mb-5 text-ink-soft">{t.home.heroSubtitle}</p>
        <div className="mx-auto max-w-xl">
          <SearchBox />
        </div>
      </div>

      <SectionHead title={t.home.herbs} href={`/${lang}/herbs`} />
      {shownHerbs.length === 0 ? (
        <EmptyState message={t.home.noHerbs} />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {shownHerbs.map((h, i) => (
            <RecordCard key={h.id} href={`/${lang}/herbs/${h.id}`} title={h.nameThai}
              subtitle={h.nameEnglish} imageUrl={herbCovers[i]} />
          ))}
        </div>
      )}

      <SectionHead title={t.home.remedies} href={`/${lang}/remedies`} />
      {remedies.length === 0 ? (
        <EmptyState message={t.home.noRemedies} />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {remedies.map((r, i) => (
            <LinkRow key={r.id} href={`/${lang}/remedies/${r.id}`} title={r.name}
              subtitle={r.symptoms} imageUrl={remedyCovers[i]} />
          ))}
        </div>
      )}

      <SectionHead title={t.home.recentCases} href={`/${lang}/treatment-cases`} />
      {cases.length === 0 ? (
        <EmptyState message={t.home.noCases} />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {cases.map((c, i) => (
            <LinkRow key={c.id} href={`/${lang}/remedies/${c.remedyId}`} icon="✚"
              imageUrl={caseCovers[i]} title={c.symptoms || "—"}
              subtitle={t.home.treatedWithRemedy(c.remedyId)} meta={formatThaiDate(c.treatedOn)} />
          ))}
        </div>
      )}

      {provinces.length > 0 ? (
        <>
          <SectionHead title={t.home.byArea} />
          <div className="flex flex-wrap gap-2">
            {provinces.map((p) => (
              <Chip key={p.id} href={`/${lang}/districts?provinceId=${p.id}`}>{p.nameThai}</Chip>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
