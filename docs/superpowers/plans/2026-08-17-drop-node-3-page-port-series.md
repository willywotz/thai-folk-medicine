# Drop-Node Plan 3 — Page Port + Cutover (Plan Series Overview)

This is the final phase of the drop-node migration (spec:
`docs/superpowers/specs/2026-08-17-drop-node-frontend-design.md`). Porting 33
pages, ~24 components, the lib layer, auth, and the deploy cutover is far too
large for one bite-sized plan, so it is a **series**. Each sub-plan is
independently reviewable; production is unaffected until the cutover (3d).

**Key facts from the port map (`frontend/src` exploration, 2026-08-17):**

- **Staff pages are already client + React Query** — thin server `page.tsx`
  shells fetch a little initial data, then render client list/form components
  that use `staff-queries.ts` (browser `fetch` to `/api/v1/*` for reads and
  `/bff/*` for writes). Porting them is mostly: make the shell a client route
  component and repoint writes `/bff/*` → `/api/v1/*`.
- **The BFF layer is now redundant.** Every `/bff/*` route only turned the
  `session` cookie into an `Authorization: Bearer` header. **Plan 1 already
  made the Go backend read the JWT straight from the `session` cookie** and set
  it on login/logout. So the browser can call `/api/v1/*` directly with
  `credentials: "include"` and Go authorizes it. **No Node BFF is needed; no
  JWT in browser storage** — the port map's auth tradeoff is already resolved.
- **Public pages** are server-rendered via `@/lib/api.ts` (direct reads). They
  become client React Query pages.
- **`/api` proxying** is already solved by Plan 2 (nginx `/api` proxy in prod,
  Vite dev proxy in dev).
- **24 components** import `next/link`/`next/navigation` and need a router
  swap; **~18 components + `ui/*`** are framework-agnostic and port verbatim.
- **Next-specific, dropped:** `session.ts` (`next/headers`),
  `getDictionary.ts` (`next/root-params`) — the SPA reads locale from the
  router param (Plan 2's `useT`), and cookies are handled by Go + the browser.
  `proxy.ts` middleware → nginx redirect + Plan 2's `StaffGuard`.

**Sub-plans:**

- **3a — Shared layer port** (THIS file, detailed below): lib (types, schemas,
  api client, `staff-queries` repointed to `/api/v1` + `credentials`), styling
  (globals.css tokens + Thai fonts), the framework-agnostic components, the 24
  router-swaps, chrome (SiteHeader/LanguageSwitcher/staff nav), NotFound.
  Verified by typecheck + build + component tests. No routes wired yet.
- **3b — Public pages**: wire the ~10 public routes as client React Query
  pages (home, search, districts[/id], healers/[id], herbs[/id],
  remedies[/id], treatment-cases), with a NotFound path for bad ids.
- **3c — Staff pages + auth + forms**: wire the ~23 staff routes under
  `StaffGuard`; port login (POST `/api/v1/authentication/login`) + logout
  (POST `/api/v1/authentication/logout`); the 7 forms + delete lists.
- **3d — Cutover + deploy + release**: delete `frontend/` (Next app + all
  `/bff` routes); point the `frontend` compose service's image build at
  `web/`; update `compose.prod.yaml.j2`; validate; release a `v*` tag.

---

# Plan 3a — Shared Layer Port

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the frontend's shared foundation into `web/src` — the lib layer
(types, schemas, formatters, a client API layer, and `staff-queries` repointed
from `/bff/*` to `/api/v1/*` with cookie credentials), the styling (Tailwind
brand tokens + Thai fonts), the framework-agnostic components, the 24
router-swapped components, the app chrome, and a NotFound — so Plans 3b/3c can
wire pages on top. No routes are added to the router yet.

**Architecture:** Builds on Plan 2's `web/` foundation. Everything is added
under `web/src`; `frontend/` is untouched and keeps shipping. Verified by
`pnpm typecheck` + `pnpm exec vitest run` + `pnpm exec vite build` — no deploy
changes, production unaffected.

**Tech Stack:** React 19, React Router 7, React Query 5, Tailwind v4, zod,
react-hook-form, @base-ui/react, shadcn primitives, vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-08-17-drop-node-frontend-design.md`

## Global Constraints

- All new code under `web/src`. Do NOT modify `frontend/`.
- Writes and guarded reads go to `/api/v1/*` (same origin, nginx/Vite proxied)
  with `credentials: "include"` — never `/bff/*` (BFF is deleted in 3d).
- Router: `next/link` `<Link href>` → `react-router-dom` `<Link to>`;
  `useRouter().push(x)` → `useNavigate()(x)`; `usePathname()` →
  `useLocation().pathname`; `next/navigation` `notFound()` → throw a sentinel
  the route's errorElement renders as NotFound (wired in 3b).
- Keep the existing Tailwind brand tokens and class names intact (components
  reference `--bg`, `--brand`, etc.).
- `pnpm typecheck` (tsc --noEmit) must stay clean; every task ends green.
- Reuse Plan 2's `apiGet`/`apiSend` (`web/src/lib/api.ts`) as the fetch base.

## Provenance

Source files live in `frontend/src`. "Port verbatim" = copy the file and fix
only imports (path aliases stay `@/…` since `web` uses the same `@`→`src`
alias). "Router-swap" = the mechanical import/paths changes above, nothing else.

---

### Task 1: Port the lib layer (types, schemas, formatters, utils)

**Files (all copied `frontend/src/lib/*` → `web/src/lib/*`, verbatim):**
- `api-types.ts`, `format.ts`, `activity-format.ts`, `utils.ts`,
  `use-debounced-value.ts`, `auth-schema.ts`, `district-schema.ts`,
  `healer-schema.ts`, `herb-schema.ts`, `province-schema.ts`,
  `remedy-schema.ts`, `treatment-case-schema.ts`
- Test: `web/src/lib/format.test.ts`

**Interfaces:**
- Produces: all shared types (`Province`, `District`, `Healer`, `Herb`,
  `Remedy`, `TreatmentCase`, `Photo`, `Page<T>`, `SearchHit`, `Activity`,
  `Stats`), zod schemas + inferred `*Input` types, `cn()`, `formatThaiDate`,
  `patientSexLabel`, `formatActivity`, `useDebouncedValue`.

- [ ] **Step 1: Copy the portable lib files**

```bash
cd /home/foo/thai-folk-medicine
for f in api-types format activity-format utils use-debounced-value \
  auth-schema district-schema healer-schema herb-schema province-schema \
  remedy-schema treatment-case-schema; do
  cp "frontend/src/lib/$f.ts" "web/src/lib/$f.ts"
done
```
These import only each other / zod / clsx / tailwind-merge (no `next/*`).
Confirm with `grep -rl "next/" web/src/lib` → empty.

- [ ] **Step 2: Write a small failing test** `web/src/lib/format.test.ts`

Inspect `web/src/lib/format.ts` for the real export signatures first, then:

```ts
import { it, expect } from "vitest";
import { patientSexLabel } from "./format";

it("maps patient sex codes to labels", () => {
  // adjust expected strings to what format.ts actually returns
  expect(typeof patientSexLabel("male")).toBe("string");
  expect(patientSexLabel("male")).not.toEqual(patientSexLabel("female"));
});
```

- [ ] **Step 3: Run typecheck + test**

Run: `cd web && pnpm exec tsc --noEmit && pnpm exec vitest run -- format`
Expected: tsc clean; the format test passes. (If a schema file imports a type
from `api-types`, tsc confirms the copy resolved.)

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/ && git commit -m "feat(web): port shared lib types, schemas, formatters"
```

---

### Task 2: Client API layer + staff-queries repointed to /api

**Files:**
- Create/extend: `web/src/lib/api.ts` (extend Plan 2's with the read helpers)
- Copy+modify: `frontend/src/lib/staff-queries.ts` → `web/src/lib/staff-queries.ts`
- Test: `web/src/lib/staff-queries.test.ts`

**Interfaces:**
- Consumes: `apiGet`/`apiSend` (Plan 2), `api-types` (Task 1).
- Produces: read helpers used by public pages (`listHerbs`, `listRemedies`,
  `listTreatmentCases`, `listProvinces`, `getProvince`, `getFirstProvince`,
  `listDistricts`, `getDistrict`, `listHealersByDistrict`, `getHealer`,
  `listRemediesByHealer`, `getHerb`, `listRemediesByHerb`, `getRemedy`,
  `listCasesByRemedy`, `listPhotosByOwner`, `firstPhotoUrl`, `photoUrl`,
  `search`) and the full staff CRUD/query set from `staff-queries.ts` — all
  hitting `/api/v1/*` with `credentials: "include"`.

- [ ] **Step 1: Port the read helpers into `web/src/lib/api.ts`**

Read `frontend/src/lib/api.ts` for the exact function bodies + `ApiError`
class + endpoint paths. Reproduce each helper in `web/src/lib/api.ts`, but
route every call through the same-origin `/api/v1` base with credentials —
reuse the Plan 2 `request()` under the hood. Example transform (frontend's
server-side `listRemedies` → web's client version):

```ts
// frontend/src/lib/api.ts (server): fetch(`${INTERNAL_API_URL}/api/v1/remedies?...`)
// web/src/lib/api.ts (client):
export const listRemedies = (page = 1, pageSize = 12) =>
  apiGet<Page<Remedy>>(`/remedies?page=${page}&pageSize=${pageSize}`);
```
Keep the `ApiError` type/behavior (public search relies on catching a 400).
Keep `photoUrl`/`firstPhotoUrl` returning the `/api/v1/photos/...` URL string.

- [ ] **Step 2: Port `staff-queries.ts`, repointing writes `/bff/*` → `/api/v1/*`**

```bash
cp frontend/src/lib/staff-queries.ts web/src/lib/staff-queries.ts
```
Then edit `web/src/lib/staff-queries.ts`:
- Replace every `/bff/` path with the equivalent `/api/v1/` path per this map
  (from the port map §3):
  - `/bff/stats` → `/api/v1/stats`
  - `/bff/activity` → `/api/v1/activity`
  - `/bff/provinces` (POST) → `/api/v1/provinces`; `/bff/provinces/:id` → `/api/v1/provinces/:id`
  - `/bff/districts[/:id]` → `/api/v1/districts[/:id]`
  - `/bff/healers[/:id]` → `/api/v1/healers[/:id]`
  - `/bff/herbs[/:id]` → `/api/v1/herbs[/:id]`
  - `/bff/remedies[/:id]` → `/api/v1/remedies[/:id]`
  - `/bff/treatment-cases[/:id]` → `/api/v1/treatment-cases[/:id]`
  - `/bff/photos[/:id]` → `/api/v1/photos[/:id]`
- Ensure EVERY `fetch(...)` in the file passes `credentials: "include"` (the
  reads already hit `/api/v1`; the writes moved off `/bff`). The multipart
  photo upload must keep NOT setting `Content-Type` (so the boundary is set by
  the browser) but must add `credentials: "include"`.
- No `next/*` imports exist in this file; nothing else changes (React Query key
  builders, etc. stay identical).

- [ ] **Step 3: Write the failing test** `web/src/lib/staff-queries.test.ts`

Pick two representative functions (one read, one write) and assert the URL +
credentials, mocking `fetch` (mirror Plan 2's `api.test.ts` style):

```ts
import { afterEach, expect, it, vi } from "vitest";
import { createHealer } from "./staff-queries";

afterEach(() => vi.restoreAllMocks());

it("createHealer POSTs to /api/v1/healers with credentials (not /bff)", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  await createHealer(/* minimal valid payload per healer-schema */ {} as never).catch(() => {});
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toContain("/api/v1/healers");
  expect(url).not.toContain("/bff");
  expect(init).toMatchObject({ credentials: "include", method: "POST" });
});
```
(Adjust the payload/return handling to the real `createHealer` signature.)

- [ ] **Step 4: Typecheck + tests + build**

Run: `cd web && pnpm exec tsc --noEmit && pnpm exec vitest run && pnpm exec vite build`
Expected: clean; the staff-queries test proves `/api/v1` + credentials, no
`/bff`. Add `grep -rn "/bff" web/src/lib/staff-queries.ts` → must be empty.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/api.ts web/src/lib/staff-queries.ts web/src/lib/staff-queries.test.ts
git commit -m "feat(web): client API layer + staff-queries repointed to /api/v1 with cookie creds"
```

---

### Task 3: Styling — Tailwind brand tokens + Thai fonts

**Files:**
- Modify: `web/src/index.css` (bring in the brand token layer from `frontend/src/app/globals.css`)
- Modify: `web/package.json` (add `@fontsource` Thai fonts), `web/src/main.tsx` (import fonts)

**Interfaces:**
- Produces: the full brand palette / Tailwind `@theme` tokens available to every
  ported component; Noto Sans Thai + Noto Serif Thai loaded without `next/font`.

- [ ] **Step 1: Port the brand tokens into `web/src/index.css`**

Read `frontend/src/app/globals.css`. Copy its `@import "tailwindcss";` (already
present), `@import "tw-animate-css";`, `@import "shadcn/tailwind.css";`, the
`@theme inline` block, and the `:root`/`.dark` custom-property palette into
`web/src/index.css`. (Add `tw-animate-css` and `shadcn` to `web/package.json`
dependencies to match `frontend/package.json` versions.)

- [ ] **Step 2: Replace `next/font/google` with self-hosted fonts**

`frontend`'s root layout used `next/font/google` for Noto Sans/Serif Thai and
set CSS variables. In Vite, add `@fontsource/noto-sans-thai` and
`@fontsource/noto-serif-thai` to `web/package.json`, `import` them in
`web/src/main.tsx`, and define the same CSS variables (`--font-sans`,
`--font-serif` or whatever `globals.css` references) in `index.css` pointing at
those font families. Confirm the variable names match what `globals.css`/
components expect.

- [ ] **Step 3: Install + build, confirm brand CSS is emitted**

Run: `cd web && pnpm install && pnpm exec vite build`
Then confirm the built CSS contains a brand token (e.g. `grep -c -- "--brand"
dist/assets/*.css` > 0) and font-face rules for Noto Thai.

- [ ] **Step 4: Commit**

```bash
git add web/src/index.css web/package.json web/pnpm-lock.yaml web/src/main.tsx
git commit -m "feat(web): port Tailwind brand tokens + self-hosted Thai fonts"
```

---

### Task 4: Port framework-agnostic components (no router swap)

**Files:**
- Copy verbatim `frontend/src/components/* → web/src/components/*` for the
  framework-agnostic set + all `ui/*` + `staff-ui.ts`:
  `Callout, ContentBlock, DashboardStats, DefinitionList, EmptyState,
  EntityCombobox, FactPanel, HerbPicker, I18nProvider, PhotoImage, PhotoInput,
  PhotoManager, RowAvatar, StaffPageHeader, StaffPagination, StaffSearch,
  ActivityFeed`, `staff-ui.ts`, and `ui/{button,card,input,label,textarea}.tsx`.

**Interfaces:**
- Consumes: lib (Tasks 1-2), styling (Task 3).
- Produces: these components importable from `@/components/*` in `web`.

- [ ] **Step 1: Copy the files**

Copy each listed file verbatim. Then `grep -rlE "next/(link|navigation|headers|font)" web/src/components` — it MUST be empty for this set (if a file shows up, it belongs in Task 5, not here — move it).

- [ ] **Step 2: Typecheck**

Run: `cd web && pnpm exec tsc --noEmit`
Fix only import-resolution issues (paths stay `@/…`). Do NOT change component
logic. Some components import `useT`/`useLocale` — those resolve to Plan 2's
`web/src/i18n`. If a component imports from `@/lib/i18n/useT`, either add a
re-export shim at `web/src/lib/i18n/useT.ts` or update the import to
`@/i18n/useT`; pick one approach and note it. Expected: tsc clean.

- [ ] **Step 3: One component test** (representative) `web/src/components/EmptyState.test.tsx`

Render `EmptyState` with props and assert it shows the message. Run
`pnpm exec vitest run -- EmptyState`.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/ && git commit -m "feat(web): port framework-agnostic components verbatim"
```

---

### Task 5: Router-swap the 24 next/* components + chrome

**Files (copy then swap):** the 24 components from the port map §5(b):
- `next/link`: `Breadcrumb, CaseAdminList, Chip, DetailHeader, DistrictAdminList,
  HealerAdminList, HerbAdminList, LinkRow, Pagination, ProvinceAdminList,
  RecordCard, RemedyAdminList, SectionHead, SiteHeader`
- `next/navigation`: `CaseForm, DistrictForm, HealerForm, HerbForm, LoginForm,
  LogoutButton, ProvinceForm, RemedyForm`
- both: `LanguageSwitcher, StaffNavLink`
- Create: `web/src/components/NotFound.tsx`
- Tests: `web/src/components/Pagination.test.tsx`, `web/src/components/StaffNavLink.test.tsx`

**Interfaces:**
- Produces: all 24 components working under React Router; a `NotFound`
  component; `SiteHeader`/`LanguageSwitcher`/`StaffNavLink` chrome ready for the
  layouts wired in 3b/3c.

- [ ] **Step 1: Copy all 24 files** from `frontend/src/components` to `web/src/components`.

- [ ] **Step 2: Apply the mechanical swaps (identical rule across every file):**

- `import Link from "next/link"` → `import { Link } from "react-router-dom"`,
  and every `<Link href={x}>` → `<Link to={x}>`.
- `import { useRouter } from "next/navigation"` → `import { useNavigate } from
  "react-router-dom"`; `const router = useRouter()` → `const navigate =
  useNavigate()`; `router.push(x)` → `navigate(x)`; `router.replace(x)` →
  `navigate(x, { replace: true })`; drop any `router.refresh()` (React Query
  invalidation already refreshes data — keep the surrounding
  `queryClient.invalidateQueries`).
- `import { usePathname } from "next/navigation"` → `import { useLocation } from
  "react-router-dom"`; `const pathname = usePathname()` → `const { pathname } =
  useLocation()`.
- `notFound()` (if used in a component) → `throw new Response("Not Found", {
  status: 404 })` (the route errorElement in 3b renders NotFound).
- Nothing else changes — same JSX, same classNames, same logic.

Work file-by-file; after each, the file should have zero `next/*` imports.

- [ ] **Step 3: `web/src/components/NotFound.tsx`**

```tsx
import { Link, useParams } from "react-router-dom";
import { useT } from "@/i18n/useT";

export function NotFound() {
  const { lang } = useParams();
  const { t } = useT();
  return (
    <div className="p-8">
      <h1 className="text-xl">404</h1>
      <Link to={`/${lang ?? "th"}`} className="underline">
        {t.common?.home ?? "Home"}
      </Link>
    </div>
  );
}
```
(Adjust `t.common.home` to the real dictionary key.)

- [ ] **Step 4: Verify no `next/*` remains + typecheck**

Run:
```bash
grep -rlE "next/(link|navigation|headers|font)" web/src/components ; echo "should be empty above"
cd web && pnpm exec tsc --noEmit
```
Expected: no matches; tsc clean. (LoginForm/LogoutForm still reference
`/bff/session` — leave those calls for 3c, which repoints them to the Go auth
endpoints; note this in the report.)

- [ ] **Step 5: Two router-aware tests**

`Pagination.test.tsx`: render inside a `createMemoryRouter`, assert the page
links use `to=` with the right query. `StaffNavLink.test.tsx`: render at a
path, assert the active class toggles via `useLocation`.
Run `pnpm exec vitest run`.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/ && git commit -m "feat(web): router-swap 24 next/* components + NotFound"
```

---

### Task 6: CONTEXT.md + green-gate sweep

**Files:**
- Modify: `CONTEXT.md`

- [ ] **Step 1:** Under the `web/` section, note that the shared layer is ported
  (lib + schemas + `staff-queries` on `/api/v1` with cookie creds, brand
  tokens + Thai fonts, framework-agnostic components, 24 router-swapped
  components, NotFound), with pages still to be wired (3b/3c) and Next still
  serving prod until the 3d cutover.

- [ ] **Step 2: Full green gate**

Run: `cd web && pnpm exec tsc --noEmit && pnpm exec vitest run && pnpm exec vite build`
Expected: all clean. Also `grep -rn "/bff" web/src` → empty (nothing should
reference the BFF), and `grep -rlE "next/" web/src` → empty.

- [ ] **Step 3: Commit**

```bash
git add CONTEXT.md && git commit -m "docs: note shared-layer port in web/ (drop-node plan 3a)"
```

---

## Self-Review

**Spec coverage (3a slice):**
- lib types/schemas/formatters ported → Task 1. ✓
- client API + staff-queries on `/api/v1` + credentials (no `/bff`) → Task 2. ✓
- brand tokens + Thai fonts (no `next/font`) → Task 3. ✓
- framework-agnostic components → Task 4. ✓
- 24 router-swaps + NotFound → Task 5. ✓
- No `frontend/`, compose, or deploy changes → Global Constraints. ✓

**Placeholder scan:** Tasks 1/2/4/5 require inspecting real source files
(exact signatures, dictionary keys, the i18n import path decision in Task 4
Step 2) — each is called out with a concrete resolution, no blocked step.

**Type/name consistency:** paths stay `@/…` (same alias). `/api/v1` + `credentials:
"include"` is the single write convention across api.ts and staff-queries.ts.
The router-swap rule (Link/useNavigate/useLocation) is identical across all 24
files. Auth calls (`/bff/session` in LoginForm/LogoutButton) are deliberately
left for 3c and flagged, not silently ported.

**Deferred to 3b/3c/3d:** wiring public routes (3b), staff routes + auth
endpoints + forms (3c), deleting `frontend/`/BFF + compose cutover + release
(3d).
