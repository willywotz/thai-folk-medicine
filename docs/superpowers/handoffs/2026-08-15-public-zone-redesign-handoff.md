# Handoff — Public Zone Redesign

Date: 2026-08-15
Branch merged: `feat/public-zone-redesign` → `main`
Spec: `docs/superpowers/specs/2026-08-15-public-zone-redesign-design.md`
Plan: `docs/superpowers/plans/2026-08-15-public-zone-redesign.md`
Preview (mock, not the app): https://claude.ai/code/artifact/fda8c118-958f-4b5b-82e8-300903933240

## What shipped

A full restyle of the public (non-staff) frontend into the "Modern Utility"
design system, province-neutral, plus photo support. Backend, API, data model,
and the staff zone were not changed.

1. **Design tokens + serif font** — `globals.css` gains semantic tokens
   (`--brand`, `--ink*`, `--surface*`, `--line`, `--caution`) for light and dark;
   `layout.tsx` loads Noto Serif Thai for headings.
2. **Province-neutral shell** — `SiteHeader` (brand `ตำรายาพื้นบ้าน`, no province);
   the metadata title/description drop the province too. Province is now a facet
   (a chip row, a breadcrumb level), never the identity.
3. **New shared components** — `SiteHeader`, `Chip`, `LinkRow`, `SectionHead`,
   `DetailHeader`, `ContentBlock`, `Callout`, `FactPanel`.
4. **Restyled pages** — home, search, herb list/detail, remedy detail, healer,
   district (province → district breadcrumb). Shared `Breadcrumb`, `EmptyState`,
   and `not-found` were token-migrated (they broke the dark theme with `stone-*`).
5. **Photos** — real images from the polymorphic `/photos` endpoint
   (`listPhotosByOwner`, `firstPhotoUrl` in `lib/api.ts`):
   - Herb cards (home + list) and herb detail cover → herb photo, leaf fallback.
   - Remedy detail cover → remedy photo.
   - Remedy rows on home, herb detail, and healer pages → remedy photo,
     `℞` fallback. Home case rows → their remedy's photo, `✚` fallback.
   - Healer avatar → healer photo, letter fallback.

## How to run and verify

```bash
docker compose up -d --build            # start stack
docker compose --profile seed run --rm seed   # seed demo data (idempotent; -reset to wipe)
# frontend: http://localhost:3000   backend: in-network only (not published to host)
cd frontend && npm test                 # 75 tests (Vitest + RTL)
cd frontend && npm run lint && npx tsc --noEmit
```

Seed photos: solid-color placeholders attached to the **first 5 herbs** and the
**first 5 remedies** (photo ids 1–5 = herbs, 6–10 = remedies). So a photographed
remedy shows on, e.g., `/healers/1` (owns remedies 1 & 2). The home "recent"
lists surface the newest remedies/cases, which have no photos — the icon
fallback there is expected, not a bug.

## Gotcha — backend migration flip-flop (important)

Symptom: backend crash-loops with
`run migrations ... no migration found for version 13`.

Cause: the DB **volume** carried a stale `schema_migrations.version = 13` left by
an old binary, while current code embeds only migrations 1–10 (via
`backend/migrations/embed.go`, `go:embed *.sql`). A cached backend **image** that
embedded the phantom v11–13 kept re-migrating fresh volumes back to 13.

Definitive fix (verified: `select version,dirty from schema_migrations` → `10,f`):

```bash
docker compose down
docker volume rm -f thai-folk-medicine_postgres_data thai-folk-medicine_photo_data
docker compose build --no-cache backend
docker compose up -d
docker compose --profile seed run --rm seed
```

Prevention: when you rebuild, rebuild the **backend** image too, or use
`docker compose up -d --build --no-deps frontend` to touch only the frontend and
leave the healthy backend container running. DB creds: user `folk`, db
`folk_medicine`.

## Deferred / future work (needs backend or API changes)

- A `getDistrict(id)` endpoint. The district page resolves a district by fetching
  `listProvinces()` + `listDistricts()` and finding the match (a `withinlazy`
  workaround; N+1). A real endpoint would replace it.
- A province page route (`/provinces/[id]`) and a province-filtered browse, so the
  home "by area" chips can drill province → district properly (they link to
  `/districts` today).
- Richer herb facts (family, taste, part used, other names) — not in the model.
- Healer/district stat counts — not in the model.
- A province switcher/filter in the top nav (space left, not built).
- Photo N+1: `firstPhotoUrl` makes one request per owner in list pages. Add a
  batch photo endpoint if a large grid needs covers.
- Real district/province maps (the map band is a placeholder).

## Notes

- Search was removed from the top nav; the home hero search is the entry point.
- `PhotoImage` and `DefinitionList` remain but are unused by the public zone now.
- The `treatment-cases` list page was not restyled (nothing in the redesign links
  to it).
