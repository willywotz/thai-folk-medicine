# Drop-Node Plan 3b — Public Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. TDD is mandatory: failing test → confirm fail →
> minimal code → confirm pass → refactor.

**Goal:** Wire the **10 public routes** into the `web/` Vite SPA as **client React Query
pages**, on top of the shared layer already ported in Plan 3a. Each page reproduces the
behavior of its Next.js server component in `frontend/src/app/[lang]/`, but fetches
client-side via React Query and renders skeletons while pending. No staff routes, no
login (those are Plan 3c). `frontend/` stays the production app until the 3d cutover.

**Architecture:** Builds on Plan 3a. Everything is added under `web/src`; `frontend/` is
untouched. The router (`web/src/main.tsx`) currently has only the `/:lang` shell +
placeholder home. This plan adds a **public layout route** (`SiteHeader` + `<main>`) with
the 10 pages as children, each with an `errorElement` that renders `NotFound`. Verified by
`pnpm typecheck` + `pnpm test` + `pnpm build`.

**Spec:** `docs/superpowers/specs/2026-08-17-drop-node-frontend-design.md`
**Series overview:** `docs/superpowers/plans/2026-08-17-drop-node-3-page-port-series.md`

## The 10 public routes (from the 3b port map)

| # | Route (under `/:lang`) | Source `frontend/src/app/[lang]/…` | 404? |
|---|---|---|---|
| 1 | `` (index) | `page.tsx` | — |
| 2 | `herbs` | `herbs/page.tsx` | — |
| 3 | `herbs/:herbId` | `herbs/[herbId]/page.tsx` | yes |
| 4 | `remedies` | `remedies/page.tsx` | — |
| 5 | `remedies/:remedyId` | `remedies/[remedyId]/page.tsx` | yes |
| 6 | `districts` | `districts/page.tsx` | yes (bad `provinceId`) |
| 7 | `districts/:districtId` | `districts/[districtId]/page.tsx` | yes |
| 8 | `healers/:healerId` | `healers/[healerId]/page.tsx` | yes |
| 9 | `search` | `search/page.tsx` | — |
| 10 | `treatment-cases` | `treatment-cases/page.tsx` | — |

## Global constraints

- All new code under `web/src`. Do **NOT** modify `frontend/`.
- **Every** in-app link/navigation target is **locale-prefixed**: `/${lang}/…`. Reach `lang`
  via `useParams()`. This includes `href`/`basePath` props passed to `RecordCard`,
  `LinkRow`, `Breadcrumb`, `Pagination`, `SectionHead`, `Chip`, `DetailHeader.editHref`, and
  raw `<a>`/`<Link>`. A bare `/herbs` breaks the app — it drops the locale segment.
- **Server → client fetch swap** (identical rule across every page):
  - `const t = await getDictionary()` → `const t = useT()` (`@/lib/i18n/useT`).
  - `params: Promise<…>` + `await params` → `const { herbId } = useParams()`.
  - `searchParams: Promise<…>` + `await searchParams` → `const [sp] = useSearchParams()`;
    read with `sp.get("page")`.
  - The whole `await Promise.all([...])` body moves **verbatim** into a React Query
    `queryFn` (same `@/lib/api` helpers — they already exist in `web/src/lib/api.ts` and hit
    `/api/v1` with `credentials: "include"`).
  - `notFound()` → render `<NotFound />` inline (the `getX` helpers already return `null`
    on 404 via `getOrNull`). No `throw`.
- **Loading UX:** `isPending` → a `Skeleton` block (spec requires skeletons). `isError` on a
  list page → an inline error `<p>` using the page's dictionary; on a detail page a failed
  fetch is treated as not-found → `<NotFound />`.
- `pnpm typecheck` must stay clean; every task ends green. `grep -rlE "next/" web/src` stays
  empty; `grep -rn "/bff" web/src` stays empty.
- Do **not** create a `/healers` list page or a `/treatment-cases/:id` detail page — they do
  not exist in `frontend/` (confirmed).

## Canonical page pattern

Every page follows this shape. The `queryFn` body is copied from the server component
verbatim; only the top (hooks) and the render guards change.

```tsx
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { NotFound } from "@/components/NotFound";
import { Skeleton } from "@/components/Skeleton";
import { useT } from "@/lib/i18n/useT";
// … api helpers, components …

export function ExamplePage() {
  const t = useT();
  const { lang = "th", herbId } = useParams();
  const [sp] = useSearchParams();
  const pageParam = sp.get("page") ?? undefined;
  const page = Number(pageParam) || 1;
  const id = Number(herbId);

  const { data, isPending, isError } = useQuery({
    queryKey: ["herb", id, page],
    queryFn: async () => {
      // === body copied from the server component, unchanged ===
      const herb = await getHerb(id);
      // …
      return { herb /* , … */ };
    },
    enabled: Number.isInteger(id) && id > 0, // detail pages only
  });

  if (!Number.isInteger(id) || id <= 0) return <NotFound />; // detail pages only
  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (isError || !data?.herb) return <NotFound />;

  return (/* JSX copied from the server component, hrefs locale-prefixed */);
}
```

**Test pattern** (one per page; mirrors `web/src/components/Pagination.test.tsx`): render
inside `MemoryRouter` + `QueryClientProvider` + `I18nProvider`, `vi.mock("@/lib/api")` to
return fixture data, `await screen.findByText(...)` the key content, and assert one
locale-prefixed link. Use `initialEntries={["/th/herbs/1"]}` and a route matching the page.

---

### Task 1: Public shell — `SearchBox`, `PublicLayout`, `SiteHeader` locale fix

Foundation the pages depend on. Must land before Tasks 2–10.

**Files:**
- Create: `web/src/components/SearchBox.tsx` (not ported in 3a — it used `next/root-params`)
- Create: `web/src/components/PublicLayout.tsx`
- Modify: `web/src/components/SiteHeader.tsx` (locale-prefix its two links)
- Test: `web/src/components/SearchBox.test.tsx`

- [ ] **Step 1 — Write the failing test** `web/src/components/SearchBox.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

import { I18nProvider } from "@/components/I18nProvider";
import { th } from "@/lib/i18n/dictionaries/th";
import { SearchBox } from "./SearchBox";

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

describe("SearchBox", () => {
  it("navigates to the locale-prefixed /search with the term", async () => {
    render(
      <MemoryRouter initialEntries={["/th"]}>
        <I18nProvider locale="th">
          <Routes>
            <Route path="/:lang" element={<><SearchBox /><LocationProbe /></>} />
          </Routes>
        </I18nProvider>
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(th.search.boxPlaceholder), "ขิง");
    await userEvent.click(screen.getByRole("button", { name: th.common.search }));
    expect(screen.getByTestId("loc").textContent).toBe("/th/search?searchTerm=%E0%B8%82%E0%B8%B4%E0%B8%87");
  });
});
```

Run `cd web && pnpm exec vitest run -- SearchBox` → **must fail** (no `SearchBox` yet).
(`@testing-library/user-event` is a transitive dep of `@testing-library/react`; if the
import fails, `pnpm add -D @testing-library/user-event` and note it in the report.)

- [ ] **Step 2 — Create `web/src/components/SearchBox.tsx`**

Client component. The Next version was a GET `<form action="/search">`; here it navigates
via the router to the **locale-prefixed** `/search`.

```tsx
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useT } from "@/lib/i18n/useT";

export function SearchBox({
  defaultValue = "",
  size = "lg",
}: {
  defaultValue?: string;
  size?: "sm" | "lg";
}) {
  const t = useT();
  const { lang = "th" } = useParams();
  const navigate = useNavigate();
  const [term, setTerm] = useState(defaultValue);
  const pad = size === "lg" ? "px-4 py-3 text-base" : "px-3 py-2 text-sm";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate(`/${lang}/search?searchTerm=${encodeURIComponent(term.trim())}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input
        type="search"
        name="searchTerm"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={t.search.boxPlaceholder}
        aria-label={t.search.boxPlaceholder}
        className={`w-full rounded-xl border border-line bg-surface text-ink ${pad}`}
      />
      <button type="submit" className="rounded-xl bg-brand px-5 font-semibold text-white">
        {t.common.search}
      </button>
    </form>
  );
}
```

Note the `defaultValue` becomes controlled state so the box stays in sync when `/search`
mounts with a `searchTerm`. On the search page, key the `SearchBox` by term (see Task 7) so
a new URL term resets it, matching Next's `defaultValue` behavior.

- [ ] **Step 3 — Create `web/src/components/PublicLayout.tsx`**

Replaces the Next root layout's public chrome (`SiteHeader` + `<main>`). This is a React
Router **layout route** element.

```tsx
import { Outlet } from "react-router-dom";

import { SiteHeader } from "@/components/SiteHeader";

export function PublicLayout() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </>
  );
}
```

(Fonts + `bg-bg text-ink` body classes are already handled globally by Plan 3a's
`index.css` + `main.tsx`, so they are not repeated here.)

- [ ] **Step 4 — Locale-fix `web/src/components/SiteHeader.tsx`**

Its two links currently hardcode `to="/"` and `to="/staff"` — both drop the locale. Change
to read `lang` and prefix:

```tsx
import { Link, useParams } from "react-router-dom";
// …
export function SiteHeader() {
  const t = useT();
  const { lang = "th" } = useParams();
  return (
    // <Link to={`/${lang}`} …>   (brand mark)
    // <Link to={`/${lang}/staff`} …>   (for-staff)
  );
}
```

Keep everything else identical. (The `/staff` target is not wired until 3c; the link is
harmless until then.)

- [ ] **Step 5 — Green** `cd web && pnpm exec tsc --noEmit && pnpm exec vitest run -- SearchBox`
  → clean + the SearchBox test passes.

- [ ] **Step 6 — Commit** `git add web/src/components/{SearchBox,PublicLayout,SiteHeader}.tsx
  web/src/components/SearchBox.test.tsx && git commit -m "feat(web): public shell — SearchBox, PublicLayout, locale-safe SiteHeader"`

---

### Task 2: Home page (`/:lang`)

**Files:** Create `web/src/pages/HomePage.tsx`, test `web/src/pages/HomePage.test.tsx`.
Source: `frontend/src/app/[lang]/page.tsx`.

- [ ] **Step 1 — Failing test** — render `HomePage` (mock `@/lib/api` so `listHerbs` etc.
  return one item each and `listProvinces` returns one province), assert the hero title
  (`t.home.heroTitle`) and a herb `RecordCard` link with `to="/th/herbs/<id>"` appear. Run
  `pnpm exec vitest run -- HomePage` → fail.

- [ ] **Step 2 — Create `web/src/pages/HomePage.tsx`**

Move the four-list + covers `Promise.all` (lines 14–27 of the source) into one `queryFn`;
locale-prefix every `href`. Full target:

```tsx
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
  const { shownHerbs, remedies, cases, provinces, herbCovers, remedyCovers, caseCovers } = data;

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
```

- [ ] **Step 3 — Green** `pnpm exec tsc --noEmit && pnpm exec vitest run -- HomePage`.
- [ ] **Step 4 — Commit** `feat(web): home page (client React Query)`

---

### Task 3: Herbs list + Herb detail

**Files:** Create `web/src/pages/HerbsPage.tsx`, `web/src/pages/HerbPage.tsx`; one test
each. Sources: `herbs/page.tsx`, `herbs/[herbId]/page.tsx`.

- [ ] **Step 1 — Failing tests**
  - `HerbsPage.test.tsx`: mock `listHerbs` → 1 herb; assert its card link `to="/th/herbs/<id>"`.
  - `HerbPage.test.tsx`: mock `getHerb` → a herb; render at `/th/herbs/1`; assert
    `DetailHeader` title. Second case: `getHerb` → `null`; assert `NotFound` (`th.common.home`
    link) shows.

- [ ] **Step 2 — `HerbsPage.tsx`** — port of `herbs/page.tsx`. `queryFn` = `listHerbs({page})`
  + covers `Promise.all`. Render `Breadcrumb` (`href: /${lang}`), the `RecordCard` grid
  (`/${lang}/herbs/${h.id}`), and `Pagination`:
  ```tsx
  <Pagination page={data.herbPage.page} totalPages={data.herbPage.totalPages}
    searchParams={{ page: pageParam }} basePath={`/${lang}/herbs`} />
  ```
  `queryKey: ["herbs", page]`. `isPending` → `Skeleton`. `isError` → inline
  `<EmptyState message={t.herb.title} />` is wrong; use a neutral error `<p>` — reuse
  `t.home.noHerbs`? No: on error show `<EmptyState message={t.herb.noRemedies}/>`? Keep it
  honest: render `<p className="text-ink-faint">…</p>` with `t.common` — there is no generic
  error string in the public dict, so **use `t.herb.title` heading + empty grid**. Simplest
  faithful choice: treat list-fetch error like empty (`EmptyState message={t.home.noHerbs}`).
  Pick that and note it in the report.

- [ ] **Step 3 — `HerbPage.tsx`** — port of `herbs/[herbId]/page.tsx`. Guard `id` (`NotFound`
  if not a positive int). `queryFn`: `getHerb(id)`; if `null` the render guard shows
  `NotFound`; else `Promise.all([listRemediesByHerb(id,{page}), listPhotosByOwner("herb",id)])`
  then remedy covers. Locale-prefix: `Breadcrumb` (`/${lang}`, `/${lang}/herbs`),
  `DetailHeader editHref={`/${lang}/staff/herbs/${herb.id}/edit`}`, `LinkRow`
  (`/${lang}/remedies/${r.id}`), `Pagination basePath={`/${lang}/herbs/${id}`}`. The cover
  `<img src={photoUrl(cover.id)}>` and `<Leaf/>` fallback stay verbatim.
  `queryKey: ["herb", id, page]`, `enabled: Number.isInteger(id) && id > 0`.

- [ ] **Step 4 — Green + commit** `feat(web): herbs list + herb detail pages`

---

### Task 4: Remedies list + Remedy detail

**Files:** `web/src/pages/RemediesPage.tsx`, `web/src/pages/RemedyPage.tsx` + tests.
Sources: `remedies/page.tsx`, `remedies/[remedyId]/page.tsx`.

- [ ] **Step 1 — Failing tests** — `RemediesPage`: card link `/th/remedies/<id>`.
  `RemedyPage`: title renders; `getRemedy → null` → `NotFound`.
- [ ] **Step 2 — `RemediesPage.tsx`** — mirror `HerbsPage` with `listRemedies`,
  `RecordCard href={`/${lang}/remedies/${r.id}`}`, `basePath={`/${lang}/remedies`}`.
- [ ] **Step 3 — `RemedyPage.tsx`** — port `remedies/[remedyId]/page.tsx`. `queryFn`:
  `getRemedy(id)`; then `Promise.all([listCasesByRemedy(id,{page}), firstPhotoUrl("remedy",id)…])`.
  Keep the `ContentBlock`s, the herb-ingredient list, the `Callout`, and the per-case cards
  (`formatThaiDate`/`patientSexLabel`) verbatim. **Locale-prefix the raw `<a href>` herb
  links**: change `href={`/herbs/${h.herbId}`}` → a router `<Link to={`/${lang}/herbs/${h.herbId}`}>`
  (import `Link` from `react-router-dom`; a bare `<a>` would do a full page reload).
  `DetailHeader editHref={`/${lang}/staff/remedies/${remedy.id}/edit`}`,
  `Breadcrumb` (`/${lang}`, `/${lang}/remedies`), `Pagination basePath={`/${lang}/remedies/${id}`}`.
- [ ] **Step 4 — Green + commit** `feat(web): remedies list + remedy detail pages`

---

### Task 5: Districts list + District detail

**Files:** `web/src/pages/DistrictsPage.tsx`, `web/src/pages/DistrictPage.tsx` + tests.
Sources: `districts/page.tsx`, `districts/[districtId]/page.tsx`.

- [ ] **Step 1 — Failing tests** — `DistrictsPage`: given a province + 1 district, a card
  links to `/th/districts/<id>`. `DistrictPage`: given a district, `DetailHeader` shows its
  name; unknown id (`getDistrict → null`) → `NotFound`.

- [ ] **Step 2 — `DistrictsPage.tsx`** — port `districts/page.tsx`. `useSearchParams` →
  `provinceId`. `queryFn`: `const province = hasId ? await getProvince(id) : await getFirstProvince();`
  then `listDistricts(province.id)`; return `{ province, districts, hasId }`. Render guards:
  - `isPending` → `Skeleton`.
  - `!province` → if `hasId` render `<NotFound/>`, else `<EmptyState message={t.district.noData}/>`.
  Cards link `/${lang}/districts/${d.id}`; `Breadcrumb` `href: /${lang}`.

- [ ] **Step 3 — `DistrictPage.tsx`** — **lazy improvement over the source.** The Next page
  did an N-province fanout (`listProvinces` then `listDistricts` for every province, then
  `.flat().find()`) to resolve the district and its province. `GET /api/v1/districts/:id`
  exists (`getDistrict` in `web/src/lib/api.ts`) and carries `provinceId`, so replace the
  fanout with two direct reads:
  ```tsx
  queryFn: async () => {
    const district = await getDistrict(id);           // null → NotFound
    if (!district) return { district: null };
    const [province, healerPage] = await Promise.all([
      getProvince(district.provinceId),
      listHealersByDistrict(id, { page }),
    ]);
    return { district, province, healerPage };
  }
  ```
  `// withinlazy: 2 reads (district + its province) replace the source's per-province fanout;
  behavior identical for a valid id.` Render: `Breadcrumb` with the optional province crumb
  (`href: /${lang}/districts`), `DetailHeader` (`t.district.provincePrefix(province.nameThai)`
  subtitle), `SectionHead`, healer `RecordCard`s → `/${lang}/healers/${h.id}`,
  `Pagination basePath={`/${lang}/districts/${id}`}`. Guard id → `NotFound`.

- [ ] **Step 4 — Green + commit** `feat(web): districts list + district detail (direct district read)`

---

### Task 6: Healer detail (`/:lang/healers/:healerId`)

**Files:** `web/src/pages/HealerPage.tsx` + test. Source: `healers/[healerId]/page.tsx`.
(No `/healers` list page — do not create one.)

- [ ] **Step 1 — Failing test** — `getHealer` → healer → name + a remedy `LinkRow`
  (`/th/remedies/<id>`); `getHealer → null` → `NotFound`.
- [ ] **Step 2 — `HealerPage.tsx`** — port verbatim. `queryFn`: `getHealer(id)`; then
  `Promise.all([listRemediesByHealer(id,{page}), firstPhotoUrl("healer",id)…])` + remedy
  covers. Keep the avatar `<img>`/initials fallback, `ContentBlock` bio, `SectionHead`,
  `LinkRow` list, `Pagination`. Locale-prefix `Breadcrumb` (`/${lang}`), `LinkRow`
  (`/${lang}/remedies/${r.id}`), `Pagination basePath={`/${lang}/healers/${id}`}`. Guard id.
- [ ] **Step 3 — Green + commit** `feat(web): healer detail page`

---

### Task 7: Search page (`/:lang/search`)

**Files:** `web/src/pages/SearchPage.tsx` + test. Source: `search/page.tsx`.

- [ ] **Step 1 — Failing tests**
  - term ≥ 2 → `search` returns 1 hit → a `LinkRow` with `to="/th/remedies/<id>"` and the
    results heading appear.
  - term length 1 → `t.search.minChars` shows, no fetch (assert `search` mock not called).
  - `search` throws `new ApiError("…", 400)` → `t.search.minChars` shows (the too-short path).

- [ ] **Step 2 — `SearchPage.tsx`** — port `search/page.tsx`. Read `searchTerm`/`page` from
  `useSearchParams`. The 400-catch logic moves into the `queryFn`; use React Query's
  `enabled: term.length >= 2` so a 1-char term never fetches:
  ```tsx
  const term = (sp.get("searchTerm") ?? "").trim();
  const page = Number(sp.get("page")) || 1;
  const { data, isPending } = useQuery({
    queryKey: ["search", term, page],
    enabled: term.length >= 2,
    queryFn: async () => {
      try {
        return { result: await search(term, { page }), tooShort: false };
      } catch (err) {
        if (err instanceof ApiError && err.status === 400) return { result: null, tooShort: true };
        throw err;
      }
    },
  });
  const tooShort = term.length === 1 || data?.tooShort === true;
  const result = data?.result ?? null;
  ```
  Guard: while `term.length >= 2 && isPending` show a `Skeleton` in the results area (not the
  whole page — the `SearchBox` must stay mounted). **Key the SearchBox by term** so a new URL
  term resets its input: `<SearchBox key={term} defaultValue={term} />`. Locale-prefix the
  `TYPE_HREF` map at render time: `` `/${lang}${TYPE_HREF[hit.type]}/${hit.id}` `` where
  `TYPE_HREF = { remedy: "/remedies", healer: "/healers", herb: "/herbs" }`. `Breadcrumb`
  `href: /${lang}`, `Pagination basePath={`/${lang}/search`}` with
  `searchParams={{ searchTerm: term, page: sp.get("page") ?? undefined }}`.
- [ ] **Step 3 — Green + commit** `feat(web): merged search page`

---

### Task 8: Treatment cases page (`/:lang/treatment-cases`)

**Files:** `web/src/pages/TreatmentCasesPage.tsx` + test. Source: `treatment-cases/page.tsx`.

- [ ] **Step 1 — Failing test** — `listTreatmentCases` → 1 case → its symptoms + a
  "view remedy" `Link` to `/th/remedies/<remedyId>` appear.
- [ ] **Step 2 — `TreatmentCasesPage.tsx`** — port verbatim. The source uses `next/link`
  `<Link href>`; swap to `react-router-dom` `<Link to={`/${lang}/remedies/${c.remedyId}`}>`.
  Keep the per-case cards + `formatThaiDate`/`patientSexLabel`. `Breadcrumb` `href: /${lang}`,
  `Pagination basePath={`/${lang}/treatment-cases`}`. `queryKey: ["treatment-cases", page]`.
- [ ] **Step 3 — Green + commit** `feat(web): treatment-cases list page`

---

### Task 9: Wire the router + green gate

**Files:** Modify `web/src/main.tsx`.

- [ ] **Step 1 — Replace the placeholder child** with the public layout route + 10 children,
  each with `errorElement={<NotFound />}`, and a catch-all under `/:lang`:

```tsx
import { NotFound } from "@/components/NotFound";
import { PublicLayout } from "@/components/PublicLayout";
import { HomePage } from "@/pages/HomePage";
import { HerbsPage } from "@/pages/HerbsPage";
import { HerbPage } from "@/pages/HerbPage";
import { RemediesPage } from "@/pages/RemediesPage";
import { RemedyPage } from "@/pages/RemedyPage";
import { DistrictsPage } from "@/pages/DistrictsPage";
import { DistrictPage } from "@/pages/DistrictPage";
import { HealerPage } from "@/pages/HealerPage";
import { SearchPage } from "@/pages/SearchPage";
import { TreatmentCasesPage } from "@/pages/TreatmentCasesPage";

// …
{
  path: "/:lang",
  element: <LangLayout />,
  children: [
    {
      element: <PublicLayout />,
      errorElement: <NotFound />,
      children: [
        { index: true, element: <HomePage /> },
        { path: "herbs", element: <HerbsPage /> },
        { path: "herbs/:herbId", element: <HerbPage /> },
        { path: "remedies", element: <RemediesPage /> },
        { path: "remedies/:remedyId", element: <RemedyPage /> },
        { path: "districts", element: <DistrictsPage /> },
        { path: "districts/:districtId", element: <DistrictPage /> },
        { path: "healers/:healerId", element: <HealerPage /> },
        { path: "search", element: <SearchPage /> },
        { path: "treatment-cases", element: <TreatmentCasesPage /> },
        { path: "*", element: <NotFound /> },
      ],
    },
  ],
},
```

Keep the existing `{ path: "/", → /th }` redirect and the top-level `{ path: "*" }` fallback.

> **Lazy note:** the spec calls for `React.lazy` per route section. It is an optional
> optimization, not required for correctness — **skip it in 3b** (YAGNI until bundle size is
> a measured problem) and leave one line in the report: `skipped: route code-splitting, add
> in 3d if the dist bundle is too large`. If the reviewer wants it now, wrap each page import
> in `lazy(() => import(...))` with a `<Suspense fallback={<Skeleton/>}>` around `<Outlet/>`.

- [ ] **Step 2 — Full green gate**
```bash
cd web && pnpm exec tsc --noEmit && pnpm exec vitest run && pnpm exec vite build
grep -rlE "next/" web/src ; echo "↑ empty"
grep -rn "/bff"  web/src ; echo "↑ empty"
```
All clean; both greps empty.

- [ ] **Step 3 — Commit** `feat(web): wire 10 public routes into the SPA router`

---

### Task 10: CONTEXT.md + handoff note

**Files:** Modify `CONTEXT.md` (and this is where Main, not a builder, integrates).

- [ ] **Step 1** — Under the `web/` section note: the 10 public routes are wired as client
  React Query pages under a `PublicLayout` (`SiteHeader` + `<main>`); skeletons while pending;
  detail 404s render `NotFound`; `SearchBox` recreated as a client component; `SiteHeader`
  links locale-fixed; `DistrictPage` uses a direct `getDistrict` read instead of the source's
  province fanout. Staff routes + login remain for 3c; `frontend/` still serves prod.
- [ ] **Step 2** — `cd web && pnpm exec tsc --noEmit && pnpm exec vitest run` one last time.
- [ ] **Step 3 — Commit** `docs: note public-page port in web/ (drop-node plan 3b)`

---

## Self-Review

**Route coverage:** all 10 public routes (Tasks 2–8) + router wiring (Task 9). ✓ No
`/healers` list or `/treatment-cases/:id` detail invented. ✓

**Locale safety:** every `href`/`to`/`basePath`/`editHref` is `/${lang}/…`; `SiteHeader` and
`SearchBox` fixed to prefix (Task 1). The two raw `<a href="/herbs/…">` cases (remedy
ingredients) are converted to router `<Link>` (Task 4). ✓

**404 paths:** `getHerb/getRemedy/getHealer/getDistrict/getProvince` already return `null` on
404 (`getOrNull`), so pages render `<NotFound/>` inline — no `notFound()`/throw. Bad numeric
ids guarded before the query. `errorElement` on the layout catches anything unhandled. ✓

**Placeholder scan:** every page's `queryFn` body is the verbatim server-component body
(sources quoted in the 3b port map); only hooks + guards change. The one behavioral change
(`DistrictPage` fanout → direct read) is called out with a `withinlazy` note and is
behavior-identical for valid ids. The one honest gap — no generic "load error" string in the
public dictionary — is resolved by treating a list-fetch error as empty and noting it. ✓

**Constraints:** no `frontend/` edits; no `/bff`; no `next/*`; typecheck green each task;
TDD (failing test first) on every page. Code-splitting deliberately deferred (YAGNI) with a
one-line note. ✓

**Deferred to 3c/3d:** staff routes + `StaffGuard` wiring, login/logout, the 7 forms (3c);
delete `frontend/` + BFF, compose cutover, release (3d).
