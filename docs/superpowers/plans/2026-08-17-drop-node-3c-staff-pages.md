# Drop-Node Plan 3c — Staff Pages + Auth + Forms

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. TDD is
> mandatory: failing test → confirm fail → minimal code → confirm pass → refactor.

**Goal:** Wire the **login page + 23 staff routes** into the `web/` Vite SPA as client React
Query pages, under a `StaffGuard` layout route + a `StaffLayout` (sidebar). Port the 6 forms
(Province, District, Healer, Remedy, Case, Herb) and the 6 admin lists, the scoped sub-routes
(healer→remedies, remedy→treatment-cases, province→districts), the read-only herb-usage page,
and the dashboard. `frontend/` stays the production app until the 3d cutover.

**Architecture:** Builds on Plan 3b. Everything is added under `web/src`; `frontend/` is
untouched. The staff list/form components and `staff-queries.ts` are already ported + repointed
to `/api/v1` (Plan 3a). `StaffGuard`, `LoginForm`, `LogoutButton`, `StaffNavLink`,
`StaffPageHeader`, `staff-ui.ts` already exist. This plan adds **page shells** that fetch the
parent option-lists client-side (React Query) and render those components, plus a `StaffLayout`
sidebar route, a login route, and the router wiring. Verified by `pnpm typecheck` + `pnpm test`
+ `pnpm build`.

**Spec:** `docs/superpowers/specs/2026-08-17-drop-node-frontend-design.md`
**Series overview:** `docs/superpowers/plans/2026-08-17-drop-node-3-page-port-series.md`

## The 24 routes (from the 3c port map)

`login` + 23 staff. All under `/:lang`. Staff routes render under `StaffGuard` + `StaffLayout`.

| # | Route | Page file | Renders |
|---|---|---|---|
| 1 | `login` | `LoginPage` | `<LoginForm/>` |
| 2 | `staff` (index) | `StaffDashboardPage` | `<StaffPageHeader/>` + `<DashboardStats/>` + `<ActivityFeed/>` |
| 3 | `staff/provinces` | `ProvincesPage` | `<StaffPageHeader/>` + `<ProvinceAdminList/>` |
| 4 | `staff/provinces/new` | `ProvinceNewPage` | `<ProvinceForm/>` |
| 5 | `staff/provinces/:provinceId` | `ProvinceDetailPage` | `<StaffPageHeader/>` + `<DistrictAdminList provinceId/>` |
| 6 | `staff/provinces/:provinceId/edit` | `ProvinceEditPage` | `<ProvinceForm province/>` |
| 7 | `staff/provinces/:provinceId/districts/new` | `DistrictNewPage` | `<DistrictForm provinceId/>` |
| 8 | `staff/provinces/:provinceId/districts/:districtId/edit` | `DistrictEditPage` | `<DistrictForm provinceId district/>` |
| 9 | `staff/healers` | `HealersPage` | `<StaffPageHeader/>` + `<HealerAdminList districts/>` |
| 10 | `staff/healers/new` | `HealerNewPage` | `<HealerForm districtOptions/>` |
| 11 | `staff/healers/:healerId/edit` | `HealerEditPage` | `<HealerForm healer districtOptions/>` |
| 12 | `staff/healers/:healerId/remedies` | `HealerRemediesPage` | `<StaffPageHeader/>` + `<RemedyAdminList healers healerId/>` |
| 13 | `staff/remedies` | `RemediesPage` | `<StaffPageHeader/>` + `<RemedyAdminList healers/>` |
| 14 | `staff/remedies/new` | `RemedyNewPage` | `<RemedyForm healerOptions defaultHealerId?>` (reads `?healerId=`) |
| 15 | `staff/remedies/:remedyId/edit` | `RemedyEditPage` | `<RemedyForm remedy healerOptions/>` |
| 16 | `staff/remedies/:remedyId/treatment-cases` | `RemedyCasesPage` | `<StaffPageHeader/>` + `<CaseAdminList remedies remedyId/>` |
| 17 | `staff/cases` | `CasesPage` | `<StaffPageHeader/>` + `<CaseAdminList remedies/>` |
| 18 | `staff/cases/new` | `CaseNewPage` | `<CaseForm remedyOptions defaultRemedyId?>` (reads `?remedyId=`) |
| 19 | `staff/cases/:treatmentCaseId/edit` | `CaseEditPage` | `<CaseForm treatmentCase remedyOptions/>` |
| 20 | `staff/herbs` | `HerbsPage` | `<StaffPageHeader/>` + `<HerbAdminList/>` |
| 21 | `staff/herbs/new` | `HerbNewPage` | `<HerbForm/>` |
| 22 | `staff/herbs/:herbId/edit` | `HerbEditPage` | `<HerbForm herb/>` |
| 23 | `staff/herbs/:herbId` | `HerbUsagePage` | read-only herb-usage (remedies using it) — inline client page |
| 24 | (login, #1) | — | — |

> **"7 forms" reconciliation:** the HANDOFF says "7 forms"; the port map finds **6 form
> components** (`ProvinceForm`, `DistrictForm`, `HealerForm`, `RemedyForm`, `CaseForm`,
> `HerbForm`). District is the nested one. There is no 7th. This plan ports all 6.

## Global constraints

- All new code under `web/src`. Do **NOT** modify `frontend/`.
- **Locale-prefix everything** (`/${lang}/…`) — the rule from 3b still holds. This plan's
  **Task 1** fixes the pre-existing bug where the 6 admin lists use bare `/staff/…` `<Link to>`
  (carried from the 3a router-swap). The forms already navigate to `/${lang}/staff/…`.
- **Server→client fetch swap** (same as 3b): `const t = await getDictionary()` → `const t =
  useT()`; `params`/`searchParams` Promises → `useParams()`/`useSearchParams()`; the shell's
  `await` fetches (parent option-lists) move into a React Query `queryFn` using `@/lib/api`
  helpers (`listHealers({pageSize:48})`, `listRemedies({pageSize:48})`, `getFirstProvince`,
  `listDistricts`, `getProvince`, `getHealer`, `getRemedy`, `getTreatmentCase`, `getHerb`,
  `listRemediesByHerb`). `notFound()` → render `<NotFound/>` inline (the `get*` helpers return
  `null` on 404).
- **Auth gate = `StaffGuard`** (already exists, `web/src/components/StaffGuard.tsx`): a layout
  route that probes `GET /api/v1/authentication/session`; pending → `Skeleton`; error →
  `<Navigate to={`/${lang}/login`} replace/>`; success → `<Outlet/>`. All staff routes mount
  under it. **The login page does NOT mount under `StaffGuard`** (it's public). The Next
  `proxy.ts` "logged-in → /login bounces to /staff" rule becomes a client guard on the login
  route (Task 9): if a session probe succeeds, redirect to `/${lang}/staff`.
- `StaffLayout` (sidebar + `<main>`) is a layout route **nested inside `StaffGuard`**, so the
  guard runs once for the whole staff subtree.
- `pnpm typecheck` clean each task; `grep -rnE "from ['\"]next/" web/src` empty; `grep -rn
  "/bff" web/src` empty (only the staff-queries test asserting absence).

## Component prop signatures (already ported in 3a — compose, don't rewrite)

Lists (all React-Query-internal via `staff-queries`):
- `ProvinceAdminList()` · `DistrictAdminList({ provinceId })` · `HealerAdminList({ districts: District[] })`
- `RemedyAdminList({ healers: Pick<Healer,"id"|"fullName">[], healerId?: number })`
- `CaseAdminList({ remedies: {id,name,healerId}[], remedyId?: number })` · `HerbAdminList()`

Forms:
- `ProvinceForm({ province? })` · `DistrictForm({ provinceId, district? })`
- `HealerForm({ healer?, districtOptions: {value,label}[] })`
- `HerbForm({ herb? })`
- `RemedyForm({ remedy?, healerOptions: {value,label}[], defaultHealerId? })`
- `CaseForm({ treatmentCase?, remedyOptions: {value,label,healerId}[], defaultRemedyId? })`

Dashboard: `DashboardStats()` · `ActivityFeed()` — no props.
Chrome: `StaffPageHeader({ crumbs?, eyebrow?, title })`, `StaffNavLink({ href, match?, children })`,
`LogoutButton()`.

## Canonical staff-page pattern

A shell that fetches parent options, then renders the component. Option lists are large
(`pageSize:48` to grab everything in one page; the catalogue is small).

```tsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { NotFound } from "@/components/NotFound";
import { Skeleton } from "@/components/Skeleton";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { RemedyAdminList } from "@/components/RemedyAdminList";
import { useT } from "@/lib/i18n/useT";
import { listHealers } from "@/lib/api";

export function RemediesPage() {
  const t = useT();
  const { lang = "th" } = useParams();
  const { data, isPending, isError } = useQuery({
    queryKey: ["healers-all"],
    queryFn: () => listHealers({ pageSize: 48 }),
  });
  if (isPending) return <Skeleton className="m-8 h-24" />;
  if (isError) return <p className="text-destructive">{t.staff.errorLoadHealers}</p>;
  const healers = data.items;
  return (
    <>
      <StaffPageHeader crumbs={[{ label: t.staff.workspace, href: `/${lang}/staff` }]}
        eyebrow={t.staff.headers.remediesEyebrow} title={t.staff.headers.remedies} />
      <RemedyAdminList healers={healers} />
    </>
  );
}
```

**Test pattern:** render inside `MemoryRouter` + `QueryClientProvider`(retry:false) +
`I18nProvider locale="th"` at the right route, `vi.mock("@/lib/api")` for the option fetch,
`vi.mock("@/components/<Comp>")` to stub the list/form (assert it received the right props) OR
let it render and mock `@/lib/staff-queries`. Prefer mocking the heavy child component and
asserting the **page** wired props + a locale-prefixed breadcrumb link — pages are thin, so the
test asserts the wiring (option fetch → props → component), not the component's internals (those
have their own tests from 3a). One test per page is enough.

---

### Task 1: Locale-fix the 6 admin lists (blocking)

**Why first:** every staff page renders one of these lists, and their bare `/staff/…` `<Link
to>` props drop the locale segment — broken under `/:lang`. Fix once, where all callers route
through. This is the lazy root-cause fix (one guard per shared component, not per page).

**Files (modify):** `web/src/components/{ProvinceAdminList,DistrictAdminList,HealerAdminList,RemedyAdminList,CaseAdminList,HerbAdminList}.tsx`
**Test (modify/extend):** `web/src/components/StaffNavLink.test.tsx` already covers active
state; add a small test asserting a list link is locale-prefixed.

- [ ] **Step 1 — Failing test** `web/src/components/AdminListLocale.test.tsx`: render
  `HerbAdminList` (mock `@/lib/staff-queries` so `fetchHerbs`→`{items:[{id:5,nameThai:"ขิง",nameEnglish:"Ginger",scientificName:"",properties:"",description:"",createdAt:"",updatedAt:""}],page:1,totalPages:1,total:1,pageSize:20}` and `deleteHerb`→resolves; mock `firstPhotoUrl`/`RowAvatar` fetches as needed) inside `MemoryRouter` at `/th/staff/herbs` + `I18nProvider locale="th"`. Assert the "+New" link has `href="/th/staff/herbs/new"` and an edit link has `href="/th/staff/herbs/5/edit"`. Run `pnpm exec vitest run -- AdminListLocale` → RED (currently `/staff/herbs/new`).

- [ ] **Step 2 — Fix all 6 lists.** In each, read `const { lang = "th" } = useParams();` (add the
  import) and prefix every `to="/staff/…"` / `to={`/staff/…`}` with `/${lang}`. The exact links
  per file (from the grep):
  - `HerbAdminList`: `to="/staff/herbs/new"` → `` to={`/${lang}/staff/herbs/new`} ``;
    `to={`/staff/herbs/${h.id}`}` → `` to={`/${lang}/staff/herbs/${h.id}`} ``;
    `to={`/staff/herbs/${h.id}/edit`}` → prefix.
  - `ProvinceAdminList`: `to="/staff/provinces/new"`; `to={`/staff/provinces/${p.id}`}` (×2);
    `to={`/staff/provinces/${p.id}/edit`}`.
  - `DistrictAdminList`: `to={`/staff/provinces/${provinceId}/districts/new`}`;
    `to={`/staff/provinces/${provinceId}/districts/${d.id}/edit`}`.
  - `HealerAdminList`: `to="/staff/healers/new"`; `to={`/staff/healers/${h.id}/remedies`}`;
    `to={`/staff/healers/${h.id}/edit`}`.
  - `RemedyAdminList`: the `+New` `to={healerId !== undefined ? `/staff/remedies/new?healerId=${healerId}` : "/staff/remedies/new"}` → prefix both branches with `/${lang}`;
    `to={`/staff/remedies/${r.id}/treatment-cases`}`; `to={`/staff/remedies/${r.id}/edit`}`.
  - `CaseAdminList`: the `+New` `to={remedyId !== undefined ? `/staff/cases/new?remedyId=${remedyId}` : "/staff/cases/new"}` → prefix both; `to={`/staff/cases/${c.id}/edit`}`.
  - **Leave `StaffNavLink` `to={href}` alone** — the `href` it receives is already locale-prefixed by the `StaffLayout` (Task 2). Do not double-prefix.
  Nothing else changes — same JSX, classes, logic.

- [ ] **Step 3 — Green + grep.** `pnpm exec vitest run -- AdminListLocale` → GREEN. Then
  `grep -rnE 'to="/staff|to=\{`/staff' web/src/components` → must be empty (no bare `/staff` `to`
  targets remain). `cd web && pnpm exec tsc --noEmit` → clean.

- [ ] **Step 4 — Commit** `fix(web): locale-prefix staff admin-list links (drop-node 3c task 1)`

---

### Task 2: StaffLayout (sidebar) + dashboard page

**Files:** Create `web/src/components/StaffLayout.tsx`, `web/src/pages/StaffDashboardPage.tsx`
(+ test). Source: `frontend/src/app/[lang]/staff/layout.tsx` + `frontend/src/app/[lang]/staff/page.tsx`.

- [ ] **Step 1 — Failing test** `web/src/components/StaffLayout.test.tsx`: render `StaffLayout`
  with a child `<div>page</div>` inside `MemoryRouter` at `/th/staff` + `I18nProvider`. Assert
  the 6 `StaffNavLink`s have locale-prefixed `href` (`/th/staff`, `/th/staff/provinces`,
  `/th/staff/healers`, `/th/staff/remedies`, `/th/staff/cases`, `/th/staff/herbs`) and a
  `LogoutButton` renders. RED.

- [ ] **Step 2 — `StaffLayout.tsx`** — port the Next `staff/layout.tsx` chrome to a React Router
  layout route. Sidebar with brand block, the 6 `StaffNavLink`s (locale-prefixed `href` +
  `match[]`), `LogoutButton`, and `<main><Outlet/></main>` in the `grid md:grid-cols-[228px_1fr]`.
  Use the `NAV_ITEMS` from the source (read `frontend/src/app/[lang]/staff/layout.tsx:8-66` for
  the exact labels/icons/`match`). `useT()` for labels; `const { lang = "th" } = useParams()`.
  ```tsx
  import { Outlet, useParams } from "react-router-dom";
  import { StaffNavLink } from "@/components/StaffNavLink";
  import { LogoutButton } from "@/components/LogoutButton";
  import { useT } from "@/lib/i18n/useT";
  // NAV_ITEMS: { href: `/${lang}/staff…`, match: [...], label, icon }
  export function StaffLayout() {
    const t = useT();
    const { lang = "th" } = useParams();
    const items = [/* dashboard, province, healer, remedy, case, herb — hrefs prefixed */];
    return (
      <div className="grid gap-6 md:grid-cols-[228px_1fr]">
        <aside className="space-y-4">
          {/* brand block */}{/* "records" label */}{items.map(...StaffNavLink)}<LogoutButton/>
        </aside>
        <main><Outlet/></main>
      </div>
    );
  }
  ```

- [ ] **Step 3 — `StaffDashboardPage.tsx`** — port `staff/page.tsx`. The shell fetches
  `getFirstProvince()` for the header eyebrow; render `<StaffPageHeader eyebrow=… title=…/>` +
  `<DashboardStats/>` + `<ActivityFeed/>`. `getFirstProvince` returns `null` if no provinces —
  header still renders (handle null eyebrow). `queryKey: ["first-province"]`; `isPending`→`Skeleton`.

- [ ] **Step 4 — Green + commit** `feat(web): StaffLayout sidebar + dashboard page`

---

### Task 3: Login page + login-route guard

**Files:** Create `web/src/pages/LoginPage.tsx` (+ test). `LoginForm` already exists (posts to
`/api/v1/authentication/login`, navigates to `/${lang}/staff` on success).

- [ ] **Step 1 — Failing test** `web/src/pages/LoginPage.test.tsx`: render `LoginPage` at
  `/th/login`. Mock `@/lib/api` `apiGet` → reject (no session) so the guard lets the form show.
  Assert the `<h1>` (`t.login.title`) and the LoginForm render. Second case: `apiGet("/authentication/session")` → resolves (session exists) → assert a `<Navigate>` to `/th/staff` (the logged-in-bounces-to-staff rule). Use `MemoryRouter` + a `LocationProbe` to assert the redirect target.

- [ ] **Step 2 — `LoginPage.tsx`** — port `login/page.tsx` + the `proxy.ts` "logged-in → /staff"
  rule. Render `<h1>{t.login.title}</h1>` + `<LoginForm/>`. **Add the client guard:** a
  `useQuery({ queryKey:["session"], queryFn:()=>apiGet("/authentication/session"), retry:false })`;
  if it succeeds (session exists) → `<Navigate to={`/${lang}/staff`} replace/>`; if pending →
  `Skeleton`; if error (no session) → render the form. (Mirrors `StaffGuard`'s inverse.)
  ```tsx
  import { Navigate, useParams } from "react-router-dom";
  import { useQuery } from "@tanstack/react-query";
  import { LoginForm } from "@/components/LoginForm";
  import { Skeleton } from "@/components/Skeleton";
  import { apiGet } from "@/lib/api";
  import { useT } from "@/lib/i18n/useT";
  export function LoginPage() {
    const t = useT();
    const { lang = "th" } = useParams();
    const q = useQuery({ queryKey: ["session"], retry: false, queryFn: () => apiGet("/authentication/session") });
    if (q.isSuccess) return <Navigate to={`/${lang}/staff`} replace />;
    if (q.isPending) return <Skeleton className="m-8 h-24" />;
    return (<section className="mx-auto max-w-sm py-12"><h1 className="mb-6 font-serif text-2xl text-ink">{t.login.title}</h1><LoginForm/></section>);
  }
  ```

- [ ] **Step 3 — Green + commit** `feat(web): login page + logged-in redirect guard`

---

### Task 4: Province section (list + new + detail + edit + district new/edit)

**Files:** `web/src/pages/{ProvincesPage,ProvinceNewPage,ProvinceDetailPage,ProvinceEditPage,DistrictNewPage,DistrictEditPage}.tsx`
(+ tests). Sources: `staff/provinces/…`. 6 routes (#3–8).

- [ ] **Step 1 — Failing tests** (one per page; mock the child component, assert wiring):
  - `ProvincesPage`: renders `<StaffPageHeader/>` + `<ProvinceAdminList/>`.
  - `ProvinceNewPage`: renders `<ProvinceForm/>` (no province prop) under a header.
  - `ProvinceDetailPage`: `getProvince(1)`→province → `<DistrictAdminList provinceId={1}/>`; `getProvince(99)`→null → `<NotFound/>`.
  - `ProvinceEditPage`: `getProvince(1)`→province → `<ProvinceForm province={…}/>`; null → NotFound.
  - `DistrictNewPage`: `getProvince(1)`→province → `<DistrictForm provinceId={1}/>`; null → NotFound.
  - `DistrictEditPage`: `Promise.all([getProvince(1), getDistrict(7)])` with `district.provinceId===1` → `<DistrictForm provinceId={1} district={…}/>`; mismatch or null → NotFound.
- [ ] **Step 2 — Create the 6 pages** per the canonical pattern. The detail/edit/district pages
  guard `id` (`NotFound` if not positive int), `enabled` on the query, `isPending`→`Skeleton`,
  null→`NotFound`. Locale-prefix `StaffPageHeader` crumbs (`/${lang}/staff`, `/${lang}/staff/provinces`).
  `DistrictEditPage` validates `district.provinceId === provinceId` (the source does, `:20`) →
  mismatch → `<NotFound/>`.
- [ ] **Step 3 — Green + commit** `feat(web): province + district staff pages`

---

### Task 5: Healer section (list + new + edit + scoped remedies)

**Files:** `web/src/pages/{HealersPage,HealerNewPage,HealerEditPage,HealerRemediesPage}.tsx`
(+ tests). Sources: `staff/healers/…`. 4 routes (#9–12).

- [ ] **Step 1 — Failing tests:**
  - `HealersPage`: shell fetches `getFirstProvince()` + `listDistricts(province.id)` → `<HealerAdminList districts={…}/>`; no province → empty districts list (the list handles empty).
  - `HealerNewPage`: same fetch → `<HealerForm districtOptions={…}/>` (`districtOptions = districts.map(d => ({value:d.id,label:`${d.nameEnglish} · ${d.nameThai}`}))`).
  - `HealerEditPage`: `getHealer(id)` + districts → `<HealerForm healer districtOptions/>`; healer null → NotFound.
  - `HealerRemediesPage`: `getHealer(id)` + `listHealers({pageSize:48})` → `<RemedyAdminList healers healerId={id}/>`; healer null → NotFound.
- [ ] **Step 2 — Create the 4 pages.** `HealersPage`/`HealerNewPage`: if `getFirstProvince()`
  returns null, pass `districts: []` (or `districtOptions: []`) — the form/list handle empty.
  Locale-prefix crumbs. Guard ids.
- [ ] **Step 3 — Green + commit** `feat(web): healer staff pages + scoped remedies`

---

### Task 6: Remedy section (list + new + edit + scoped cases)

**Files:** `web/src/pages/{RemediesPage,RemedyNewPage,RemedyEditPage,RemedyCasesPage}.tsx`
(+ tests). Sources: `staff/remedies/…`. 4 routes (#13–16).

- [ ] **Step 1 — Failing tests:**
  - `RemediesPage`: `listHealers({pageSize:48})` → `<RemedyAdminList healers/>`.
  - `RemedyNewPage`: reads `?healerId=` from `useSearchParams`; fetches `listHealers` + `getFirstProvince` + `listDistricts` to build `healerOptions = healers.map(h => ({value:h.id,label:h.fullName}))` (the source also fetches districts but the form only needs `healerOptions`; **lazy: drop the unused districts fetch** if the form doesn't use it — confirm by reading `RemedyForm`, note it). Renders `<RemedyForm healerOptions defaultHealerId={healerIdParam}/>` where `defaultHealerId` is the parsed `?healerId=` or undefined.
  - `RemedyEditPage`: `getRemedy(id)` + `listHealers` → `<RemedyForm remedy healerOptions/>`; null → NotFound.
  - `RemedyCasesPage`: `getRemedy(id)` + `listRemedies({pageSize:48})` → `<CaseAdminList remedies remedyId={id}/>`; null → NotFound.
- [ ] **Step 2 — Create the 4 pages.** `RemedyNewPage` parses `?healerId=` (guard: positive int
  or undefined). `healerOptions` = `{value, label: h.fullName}`. Locale-prefix crumbs. Guard ids.
- [ ] **Step 3 — Green + commit** `feat(web): remedy staff pages + scoped cases`

---

### Task 7: Case section (list + new + edit)

**Files:** `web/src/pages/{CasesPage,CaseNewPage,CaseEditPage}.tsx` (+ tests). Sources:
`staff/cases/…`. 3 routes (#17–19).

- [ ] **Step 1 — Failing tests:**
  - `CasesPage`: `listRemedies({pageSize:48})` → `<CaseAdminList remedies/>` (`remedies = items.map(r => ({id,name,healerId}))`).
  - `CaseNewPage`: reads `?remedyId=`; fetches `listRemedies` + `listHealers` + province/districts to build `remedyOptions = remedies.map(r => ({value:r.id, label:r.name, healerId:r.healerId}))`. Renders `<CaseForm remedyOptions defaultRemedyId={…}/>` (confirm `CaseForm` needs `healerId` per option — yes, its type is `{value,label,healerId}[]`). **Lazy: drop unused fetches** the form doesn't need (the source fetches province+districts but `CaseForm` only takes `remedyOptions` — confirm, drop, note).
  - `CaseEditPage`: `getTreatmentCase(id)` + `listRemedies` + `listHealers` → `<CaseForm treatmentCase remedyOptions/>`; null → NotFound.
- [ ] **Step 2 — Create the 3 pages.** Parse `?remedyId=`. `remedyOptions` shape `{value,label,healerId}`. Locale-prefix crumbs. Guard ids.
- [ ] **Step 3 — Green + commit** `feat(web): treatment-case staff pages`

---

### Task 8: Herb section (list + new + edit + read-only usage page)

**Files:** `web/src/pages/{HerbsPage,HerbNewPage,HerbEditPage,HerbUsagePage}.tsx` (+ tests).
Sources: `staff/herbs/…`. 4 routes (#20–23).

- [ ] **Step 1 — Failing tests:**
  - `HerbsPage`: `<StaffPageHeader/>` + `<HerbAdminList/>` (no shell fetch).
  - `HerbNewPage`: `<HerbForm/>` under a header.
  - `HerbEditPage`: `getHerb(id)` → `<HerbForm herb/>`; null → NotFound.
  - `HerbUsagePage`: `getHerb(id)` + `listRemediesByHerb(id,{page,pageSize:20})` → the read-only herb-usage view (remedies using this herb). This page renders **inline** (no staff-queries component) like the 3b detail pages: `<StaffPageHeader/>` + herb name + a `<ul>`/`LinkRow` list of remedies (each linking to `/${lang}/staff/remedies/${r.id}/edit`) + `<Pagination basePath={`/${lang}/staff/herbs/${id}`}/>`. Reads `?page=`. Null herb → NotFound. (Source: `staff/herbs/[herbId]/page.tsx:14` — read it for the exact layout.)
- [ ] **Step 2 — Create the 4 pages.** `HerbUsagePage` mirrors the 3b `HerbPage` structure but
  staff-flavored (links to staff edit). Locale-prefix all links. Guard id; `?page=` pagination.
- [ ] **Step 3 — Green + commit** `feat(web): herb staff pages + read-only usage page`

---

### Task 9: Wire the router — login + StaffGuard + StaffLayout + 23 staff routes

**Files:** Modify `web/src/main.tsx`.

- [ ] **Step 1 — Add the login route (public, NOT under StaffGuard)** and the staff subtree
  (under `StaffGuard` → `StaffLayout` → the 23 pages), each staff route with `errorElement=
  <NotFound/>`. Add `LoginPage` as a sibling of the `PublicLayout` children:
```tsx
// inside the `/:lang` children, alongside the PublicLayout subtree:
{
  element: <PublicLayout />,
  errorElement: <NotFound />,
  children: [
    { index: true, element: <HomePage /> },
    // …the 10 public routes from 3b…
    { path: "login", element: <LoginPage /> },
    { path: "*", element: <NotFound /> },
  ],
},
{
  path: "staff",
  element: <StaffGuard />,
  errorElement: <NotFound />,
  children: [
    { element: <StaffLayout />, children: [
      { index: true, element: <StaffDashboardPage /> },
      { path: "provinces", element: <ProvincesPage /> },
      { path: "provinces/new", element: <ProvinceNewPage /> },
      { path: "provinces/:provinceId", element: <ProvinceDetailPage /> },
      { path: "provinces/:provinceId/edit", element: <ProvinceEditPage /> },
      { path: "provinces/:provinceId/districts/new", element: <DistrictNewPage /> },
      { path: "provinces/:provinceId/districts/:districtId/edit", element: <DistrictEditPage /> },
      { path: "healers", element: <HealersPage /> },
      { path: "healers/new", element: <HealerNewPage /> },
      { path: "healers/:healerId/edit", element: <HealerEditPage /> },
      { path: "healers/:healerId/remedies", element: <HealerRemediesPage /> },
      { path: "remedies", element: <RemediesPage /> },
      { path: "remedies/new", element: <RemedyNewPage /> },
      { path: "remedies/:remedyId/edit", element: <RemedyEditPage /> },
      { path: "remedies/:remedyId/treatment-cases", element: <RemedyCasesPage /> },
      { path: "cases", element: <CasesPage /> },
      { path: "cases/new", element: <CaseNewPage /> },
      { path: "cases/:treatmentCaseId/edit", element: <CaseEditPage /> },
      { path: "herbs", element: <HerbsPage /> },
      { path: "herbs/new", element: <HerbNewPage /> },
      { path: "herbs/:herbId", element: <HerbUsagePage /> },
      { path: "herbs/:herbId/edit", element: <HerbEditPage /> },
      { path: "*", element: <NotFound /> },
    ]},
  ],
},
```
Keep the existing `/` → `/th` redirect and top-level `*` fallback.

- [ ] **Step 2 — Full green gate:**
```bash
cd web && pnpm exec tsc --noEmit && pnpm exec vitest run && pnpm exec vite build
grep -rnE "from ['\"]next/" web/src ; echo "↑ empty"
grep -rn "/bff" web/src ; echo "↑ only staff-queries.test.ts"
```
All clean.

- [ ] **Step 3 — Commit** `feat(web): wire login + 23 staff routes under StaffGuard/StaffLayout`

---

### Task 10: CONTEXT.md + handoff

**Files:** Modify `CONTEXT.md` (Main integrates).

- [ ] **Step 1** — Under the `web/` section note: login + 23 staff routes wired under
  `StaffGuard` (session probe → `/login`) + `StaffLayout` (sidebar); the 6 admin lists
  locale-fixed; 6 forms + scoped sub-routes (healer→remedies, remedy→cases, province→districts)
  + read-only herb-usage page + dashboard. `frontend/` still serves prod until 3d. Remaining: 3d
  cutover (delete `frontend/` + BFF, compose image → `web/`, release `v*`).
- [ ] **Step 2** — `cd web && pnpm exec tsc --noEmit && pnpm exec vitest run` one last time.
- [ ] **Step 3 — Commit** `docs: note staff-page port in web/ (drop-node plan 3c)`

---

## Self-Review

**Route coverage:** all 24 routes (Tasks 2–8) + router wiring (Task 9). ✓ Login is public
(outside `StaffGuard`); the 23 staff routes nest under `StaffGuard`→`StaffLayout`. ✓

**Auth correctness:** `StaffGuard` gates the whole staff subtree (one probe, not per-page);
`LoginPage` inverts it (session present → redirect to `/staff`), reproducing `proxy.ts`. ✓
`LoginForm`/`LogoutButton` already hit `/api/v1/authentication/{login,logout}` (3a). ✓

**Locale safety:** Task 1 fixes the pre-existing bare-`/staff` link bug in all 6 admin lists —
the one cross-cutting defect the 3a port left. New pages locale-prefix crumbs/links (canonical
pattern). `StaffNavLink` receives already-prefixed `href` from `StaffLayout` (no double-prefix). ✓

**Shell→client fidelity:** each page's `queryFn` reproduces the Next shell's option-list fetch
(`listHealers({pageSize:48})`, `listRemedies({pageSize:48})`, `getFirstProvince`+`listDistricts`,
entity `get*`). Forms receive the same prop shapes. `HerbUsagePage` reproduces the inline
read-only view. ✓

**Lazy wins (called out):** `RemedyNewPage`/`CaseNewPage` drop province/district fetches the
forms don't consume (confirm per form, note in report) — smaller than the source's over-fetch.
District edit validates `provinceId` match like the source. ✓

**Constraints:** no `frontend/` edits; no `/bff` calls (staff-queries already repointed in 3a);
no `next/*` imports; typecheck green each task; TDD per page. ✓

**Deferred to 3d:** delete `frontend/` + BFF routes, compose cutover (`frontend` service image
→ `web/`), release `v*` tag. `frontend/` still serves prod.

**Risk note:** staff writes now go browser→`/api/v1` directly (cookie auth, Plan 1). This is
the first time the SPA exercises the write path end-to-end; a manual smoke (login → create a
herb → see it in the list → delete) is warranted after 3c before 3d. Not a code task — call it
out in the handoff.
