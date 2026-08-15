# Staff Workspace Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the staff zone into six entity-first sections (Dashboard, Province, Healer, Remedy, Case, Herb), add province/district CRUD, and add a persisted-event activity feed + stats for a new dashboard.

**Architecture:** Backend keeps Clean Architecture (`domain ← usecase ← adapter/platform`) and the event bus. New location writes publish events; an audit subscriber persists every event to `event_log` (a read model). Frontend replaces the nested drill-down with flat list pages + parent pickers, plus a dashboard.

**Tech Stack:** Go 1.26 (Gin, pgx/v5 + sqlc, golang-migrate, testify, testcontainers-go), Next.js App Router + TypeScript, TanStack Query, react-hook-form + zod, Vitest + RTL, Tailwind (brand tokens).

**Spec:** `docs/superpowers/specs/2026-08-15-staff-workspace-sections-design.md`

## Global Constraints

- **Clean Architecture:** dependency rule `domain ← usecase ← adapter/platform`. No Gin/pgx/sqlc types in `domain` or `usecase`.
- **Event-driven:** every write publishes a domain event. Activity feed is a read model fed by a bus subscriber; reads publish nothing.
- **15-Factor:** no new config, no new backing service. `event_log` in existing Postgres. Page-size cap stays the compile-time `listing.maxPageSize = 48`.
- **Full-English REST route names** under `/api/v1` (no abbreviations).
- **TDD mandatory:** failing test → confirm fail → minimal code → confirm pass → commit.
- **Model unchanged:** `healer.district_id` stays; District 1:n Healer.
- **Style:** uber-go for Go, google-ts for TypeScript; American English; organized imports.
- **Branch:** all work on `feat/staff-sections`.

---

## Task 0: Branch

- [ ] **Step 1:** `git checkout main && git pull` (already current), then `git checkout -b feat/staff-sections`.
- [ ] **Step 2:** Confirm `git branch --show-current` prints `feat/staff-sections`.

---

## Task 1: Event bus `SubscribeAll` + `event_log` migration

**Files:**
- Modify: `backend/internal/platform/eventbus/bus.go`
- Test: `backend/internal/platform/eventbus/bus_test.go`
- Create: `backend/migrations/<next>_event_log.up.sql`, `..._event_log.down.sql`

**Interfaces:**
- Produces: `(*Bus).SubscribeAll(h event.Handler)` — handler runs for every published event, after name-keyed handlers.

- [ ] **Step 1: Write the failing test** (append to `bus_test.go`):

```go
func TestSubscribeAllReceivesEveryEvent(t *testing.T) {
	b := eventbus.New(slog.New(slog.NewTextHandler(io.Discard, nil)))
	var got []string
	b.SubscribeAll(func(_ context.Context, e event.Event) error {
		got = append(got, e.EventName())
		return nil
	})
	b.Publish(context.Background(), stubEvent{name: "a.created"})
	b.Publish(context.Background(), stubEvent{name: "b.updated"})
	assert.Equal(t, []string{"a.created", "b.updated"}, got)
}
```

(Reuse or add a `stubEvent{ name string }` with `EventName() string` in the test file.)

- [ ] **Step 2: Run to verify it fails.** Run: `cd backend && go test ./internal/platform/eventbus/`. Expected: FAIL (`SubscribeAll` undefined).

- [ ] **Step 3: Implement.** In `bus.go` add an `all []event.Handler` field; `SubscribeAll` appends to it (under the mutex); in `Publish`, after running name-keyed handlers, run every `all` handler with the same log-not-return error handling.

- [ ] **Step 4: Run to verify pass.** Run: `cd backend && go test ./internal/platform/eventbus/`. Expected: PASS.

- [ ] **Step 5: Add the migration.** `ls backend/migrations` to find the next number `N`. Create `N_event_log.up.sql`:

```sql
CREATE TABLE event_log (
    id          BIGSERIAL PRIMARY KEY,
    event_name  TEXT NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX event_log_occurred_at_idx ON event_log (occurred_at DESC, id DESC);
```

`..._event_log.down.sql`: `DROP TABLE event_log;`

- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(backend): event bus SubscribeAll + event_log table"`

---

## Task 2: Audit read model — recorder + activity endpoint

**Files:**
- Create: `backend/internal/domain/audit/audit.go` (Entry entity + `Repository` port)
- Create: `backend/internal/usecase/audit/recorder.go`, `.../reader.go`
- Create: `backend/internal/adapter/repository/db/query/event_log.sql` + regenerate
- Create: `backend/internal/adapter/repository/event_log_repository.go`
- Create: `backend/internal/adapter/http/activity_handler.go`
- Modify: `backend/cmd/api/main.go` (wire recorder to `bus.SubscribeAll`, register handler)
- Test: `..._repository/event_log_repository_test.go`, `.../http/activity_handler_test.go`, `usecase/audit/recorder_test.go`

**Interfaces:**
- Consumes: `listing.Params`, `listing.Page[T]`, `eventbus.SubscribeAll`.
- Produces:
  - `audit.Entry{ ID int64; EventName string; Payload json.RawMessage; OccurredAt time.Time }`
  - `audit.Repository{ Record(ctx, name string, payload []byte) error; List(ctx, listing.Params) (listing.Page[Entry], error) }`
  - `audit.Recorder.Handle(ctx, event.Event) error` (marshals + records)
  - `audit.Reader.List(ctx, listing.Params) (listing.Page[Entry], error)`
  - `GET /api/v1/activity?page&pageSize` (protected) → `Page[Entry]` JSON, newest first.

- [ ] **Step 1: Failing repo test.** In `event_log_repository_test.go` (mirror an existing repo test's testcontainer setup, e.g. `healer_repository_test.go`): record two rows, `List` with `Params{Limit:10,Offset:0}`, assert `Total==2` and newest-first order.

- [ ] **Step 2: Run → fail.** `cd backend && go test ./internal/adapter/repository/ -run EventLog`. Expected: FAIL (types undefined).

- [ ] **Step 3: Implement domain + queries + repo.** Add `audit.go`. Add `event_log.sql` with `InsertEventLog` and `ListEventLog` (`ORDER BY occurred_at DESC, id DESC LIMIT $1 OFFSET $2`) + `CountEventLog`. Run `cd backend && sqlc generate`. Implement `event_log_repository.go` mapping sqlc rows → `audit.Entry` and `listing.Page`.

- [ ] **Step 4: Run → pass.** `cd backend && go test ./internal/adapter/repository/ -run EventLog`. Expected: PASS.

- [ ] **Step 5: Failing recorder test.** `recorder_test.go`: a fake `audit.Repository` capturing `Record`; call `Recorder.Handle(ctx, stubEvent)`; assert name + JSON payload captured.

- [ ] **Step 6: Implement recorder + reader** (`json.Marshal(e)` → `repo.Record`). Run → pass.

- [ ] **Step 7: Failing handler test.** `activity_handler_test.go` (mirror `healer_handler_test.go`): fake reader returning one `Entry`; `GET /activity?page=1&pageSize=10`; assert 200 + envelope `{items,page,pageSize,total,totalPages}`.

- [ ] **Step 8: Implement handler + route.** `activity_handler.go` with `Register(public, protected)` registering `protected.GET("/activity", h.List)`; parse paging with the shared `listing` helper. Run → pass.

- [ ] **Step 9: Wire in `main.go`.** Construct repo → reader + recorder; `bus.SubscribeAll(recorder.Handle)`; construct + `Register` the activity handler. Run `cd backend && go build ./... && go test ./...`.

- [ ] **Step 10: Commit.** `git commit -am "feat(backend): persist events to event_log + GET /activity"`

---

## Task 3: Flat healer list — `GET /api/v1/healers`

**Files:**
- Modify: `backend/internal/domain/healer/healer.go` (Repository: add `ListHealer`, `CountHealer` with optional `districtID *int64`)
- Modify: `backend/internal/adapter/repository/db/query/healer.sql` + regenerate
- Modify: `backend/internal/adapter/repository/healer_repository.go`
- Modify: `backend/internal/usecase/healer/service.go` (add `List`)
- Modify: `backend/internal/adapter/http/healer_handler.go` (add `ListPage` + route)
- Test: repo, service, handler test files for healer.

**Interfaces:**
- Produces:
  - repo `ListHealer(ctx, p listing.Params, districtID *int64) ([]healer.Healer, error)`, `CountHealer(ctx, districtID *int64) (int, error)`
  - `HealerService.List(ctx, p listing.Params, districtID *int64) (listing.Page[healer.Healer], error)`
  - route `public.GET("/healers", h.ListPage)`; query `districtId` optional.

- [ ] **Step 1: Failing repo test.** Seed 3 healers across 2 districts; `ListHealer` with `districtID=nil` → 3; with a district → its subset; check `CountHealer`.
- [ ] **Step 2: Run → fail.** `cd backend && go test ./internal/adapter/repository/ -run Healer`.
- [ ] **Step 3: Implement.** Add sqlc `ListHealer`/`CountHealer` using `sqlc.narg('district_id')` (nullable filter: `WHERE ($3::bigint IS NULL OR district_id = $3)`). `sqlc generate`; implement repo methods.
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Failing service test** (`service.List` returns a `Page` with `Total`). Implement. Run → pass.
- [ ] **Step 6: Failing handler test** — `GET /healers?districtId=3&page=1&pageSize=48` → 200 envelope. Implement `ListPage` (mirror remedy `ListPage`) + register route before `:healerId` routes. Run → pass.
- [ ] **Step 7:** `go build ./... && go test ./...`; commit `feat(backend): GET /healers flat list with district filter`.

---

## Task 4: Location domain — write ports, errors, events

**Files:**
- Modify: `backend/internal/domain/location/location.go` (errors + Repository writes + counts + `GetProvince`)
- Create: `backend/internal/domain/location/event.go` (six event types)
- Test: `backend/internal/domain/location/event_test.go`

**Interfaces:**
- Produces:
  - errors `ErrProvinceNotFound`, `ErrProvinceReferenced`, `ErrDistrictReferenced`
  - Repository adds: `GetProvince(ctx,id)`, `CreateProvince`, `UpdateProvince`, `DeleteProvince`, `CountDistrictByProvince(ctx,provinceID)`, `CreateDistrict`, `UpdateDistrict`, `DeleteDistrict`, `CountHealerByDistrict(ctx,districtID)`
  - events implementing `event.Event`: `ProvinceCreated/Updated/Deleted{ProvinceID int64; NameThai,NameEnglish string}` (names `province.created` etc.), `DistrictCreated/Updated/Deleted{DistrictID, ProvinceID int64; NameThai,NameEnglish string}` (`district.created` etc.)

- [ ] **Step 1: Failing test** — `event_test.go` asserts `ProvinceCreated{}.EventName() == "province.created"` for all six.
- [ ] **Step 2: Run → fail.** `cd backend && go test ./internal/domain/location/`.
- [ ] **Step 3: Implement** `event.go` (mirror `domain/healer/event.go`) + add the sentinel errors + widen the `Repository` interface in `location.go`. (Interface widening breaks the adapter until Task 5/6 — that is expected; this task's test is domain-only. Build the repo methods in Task 5/6.)
- [ ] **Step 4: Run → pass** (domain package compiles and tests pass in isolation: `go test ./internal/domain/location/`).
- [ ] **Step 5: Commit** `feat(backend): location write ports, errors, events`.

---

## Task 5: Province CRUD — repo + service + handler

**Files:**
- Modify: `backend/internal/adapter/repository/db/query/location.sql` (+ regenerate) — province writes, `GetProvince`, `CountDistrictByProvince`
- Modify: `backend/internal/adapter/repository/location_repository.go`
- Modify: `backend/internal/usecase/location/service.go` (province Create/Update/Delete publishing events, guard)
- Modify: `backend/internal/adapter/http/location_handler.go` (routes + handlers)
- Test: repo, service, handler.

**Interfaces:**
- Consumes: Task 4 errors/events; `eventbus`.
- Produces:
  - `LocationService.CreateProvince(ctx, nameThai, nameEnglish) (Province, error)`, `UpdateProvince(ctx, id, ...)`, `DeleteProvince(ctx, id) error` (returns `ErrProvinceReferenced` if `CountDistrictByProvince>0`)
  - `GetProvince(ctx,id)`
  - routes: `public.GET("/provinces/:provinceId")`, `protected.POST("/provinces")`, `protected.PUT("/provinces/:provinceId")`, `protected.DELETE("/provinces/:provinceId")`

- [ ] **Step 1: Failing repo test** — create/get/update/delete a province; `CountDistrictByProvince`.
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** sqlc queries (`CreateProvince … RETURNING *`, `GetProvince`, `UpdateProvince`, `DeleteProvince`, `CountDistrictByProvince`) → `sqlc generate` → repo methods.
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Failing service test** — `CreateProvince` publishes `province.created` (fake bus records it); `DeleteProvince` returns `ErrProvinceReferenced` when a fake repo reports districts. Implement (mirror `HealerService`). Run → pass.
- [ ] **Step 6: Failing handler test** — `POST /provinces` 201; `DELETE` of a referenced province → 409; `GET /provinces/:provinceId` 200 / 404. Implement handlers + routes; map `ErrProvinceReferenced`→409, `ErrProvinceNotFound`→404. Run → pass.
- [ ] **Step 7:** `go build ./... && go test ./...`; commit `feat(backend): province CRUD (+events, delete guard)`.

---

## Task 6: District CRUD — repo + service + handler

**Files:** same set as Task 5 for districts.

**Interfaces:**
- Produces:
  - `LocationService.CreateDistrict(ctx, provinceID, nameThai, nameEnglish)`, `UpdateDistrict`, `DeleteDistrict` (returns `ErrDistrictReferenced` if `CountHealerByDistrict>0`)
  - routes `protected.POST("/districts")`, `protected.PUT("/districts/:districtId")`, `protected.DELETE("/districts/:districtId")`

- [ ] **Step 1: Failing repo test** — create/update/delete a district; `CountHealerByDistrict`.
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** sqlc (`CreateDistrict … RETURNING *`, `UpdateDistrict`, `DeleteDistrict`, `CountHealerByDistrict`) → generate → repo.
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Failing service test** — `CreateDistrict` publishes `district.created`; `DeleteDistrict` → `ErrDistrictReferenced` when healers exist. Implement. Run → pass.
- [ ] **Step 6: Failing handler test** — `POST /districts` 201 (body `{provinceId,nameThai,nameEnglish}`); referenced `DELETE` → 409. Implement + routes; map errors. Run → pass.
- [ ] **Step 7:** build + full test; commit `feat(backend): district CRUD (+events, delete guard)`.

---

## Task 7: Stats endpoint — `GET /api/v1/stats`

**Files:**
- Create: `backend/internal/usecase/stats/service.go`
- Create: `backend/internal/adapter/http/stats_handler.go`
- Modify: `main.go` (wire)
- Test: service + handler.

**Interfaces:**
- Consumes: the `Count*` methods on each repo (healer, remedy, treatmentcase, herb) + `CountProvince`/`CountDistrict` (add trivial `SELECT count(*)` sqlc queries to location).
- Produces:
  - `StatsService.Get(ctx) (Stats, error)` where `Stats{ Provinces,Districts,Healers,Remedies,Cases,Herbs int }`
  - route `protected.GET("/stats", h.Get)` → JSON `{provinces,districts,healers,remedies,cases,herbs}`.

- [ ] **Step 1: Failing service test** — fake counters → `Get` returns the six totals.
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `CountProvince`/`CountDistrict` sqlc (generate) if missing; `StatsService.Get` calling each count; handler + route.
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5:** build + full backend test `cd backend && go test ./...`; commit `feat(backend): GET /stats aggregate counts`.

---

## Task 8: Frontend API + BFF wiring

**Files:**
- Modify: `frontend/src/lib/api-types.ts` (add `Activity`, `Stats`)
- Modify: `frontend/src/lib/api.ts` (add `listHealers`, `getProvince`, `listActivity`, `getStats`)
- Modify: `frontend/src/lib/staff-queries.ts` (flat `fetchHealers`, `fetchActivity`, `fetchStats`, province/district mutations + keys)
- Create: `frontend/src/app/bff/provinces/route.ts`, `frontend/src/app/bff/provinces/[provinceId]/route.ts`, `frontend/src/app/bff/districts/route.ts`, `frontend/src/app/bff/districts/[districtId]/route.ts`
- Test: `frontend/src/lib/api.test.ts`, `frontend/src/lib/staff-queries.test.ts`

**Interfaces:**
- Produces (types):
  - `Activity{ id:number; eventName:string; occurredAt:string; payload:Record<string,unknown> }`
  - `Stats{ provinces:number; districts:number; healers:number; remedies:number; cases:number; herbs:number }`
  - `listHealers(opts:{districtId?:number}&PageOptions): Promise<Page<Healer>>`
  - `staff-queries`: `fetchHealers(districtId?:number)`, `fetchActivity()`, `fetchStats()`, `createProvince/updateProvince/deleteProvince`, `createDistrict/updateDistrict/deleteDistrict`, and query keys `healerListKey(districtId?)`, `activityKey`, `statsKey`, `provinceListKey`, `districtListKey(provinceId)`.

- [ ] **Step 1: Failing test** in `staff-queries.test.ts` — `fetchHealers()` calls `/api/healers?pageSize=48` and unwraps `.items` (mirror the existing envelope tests); `fetchStats()` returns the object.
- [ ] **Step 2: Run → fail.** `cd frontend && npx vitest run src/lib/staff-queries.test.ts`.
- [ ] **Step 3: Implement** the api/staff-queries additions (reuse the shared `fetchList` envelope helper for lists; BFF write routes mirror `bff/healers/route.ts` cookie→Bearer forwarding).
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5:** `npx tsc --noEmit`; commit `feat(frontend): api + bff wiring for healers/provinces/activity/stats`.

---

## Task 9: Sidebar — six sections

**Files:**
- Modify: `frontend/src/app/staff/layout.tsx` (six nav items + Dashboard landing)
- Modify: `frontend/src/components/StaffNavLink.tsx` (unchanged logic; new links added in layout)
- Test: `frontend/src/components/StaffNavLink.test.tsx` (add cases for `/staff/remedies`, `/staff/cases`)

- [ ] **Step 1: Failing test** — `StaffNavLink` with `href="/staff/remedies" match={["/staff/remedies"]}` is `aria-current` on `/staff/remedies/new`.
- [ ] **Step 2: Run → fail** (only if a new matching rule is needed; else adjust). `npx vitest run src/components/StaffNavLink.test.tsx`.
- [ ] **Step 3: Implement** the six-item sidebar (Dashboard `/staff` match `[]` exact; Province `/staff/provinces`; Healer `/staff/healers`; Remedy `/staff/remedies`; Case `/staff/cases`; Herb `/staff/herbs`), icons from the preview. Remove the old two-item nav.
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5:** commit `feat(frontend): six-section staff sidebar`.

---

## Task 10: Dashboard page

**Files:**
- Modify: `frontend/src/app/staff/page.tsx` (was district picker → dashboard)
- Create: `frontend/src/components/DashboardStats.tsx`, `frontend/src/components/ActivityFeed.tsx`
- Create: `frontend/src/lib/activity-format.ts` (`eventName` → verb + title from payload)
- Test: `frontend/src/components/ActivityFeed.test.tsx`, `frontend/src/lib/activity-format.test.ts`

**Interfaces:**
- Consumes: `fetchStats`, `fetchActivity`, `Activity`, `Stats`.
- Produces: `formatActivity(a:Activity): { verb:string; title:string; when:string }`.

- [ ] **Step 1: Failing test** — `formatActivity({eventName:"remedy.created", payload:{Name:"ยาแก้ไข้"}})` → `{verb:"added", title:"ยาแก้ไข้", …}`.
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `activity-format.ts` (map `*.created`→added, `*.updated`→updated, `*.deleted`→deleted; title from payload `Name`/`NameThai`/`FullName`/`Title` fallback to the entity from event prefix).
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Failing `ActivityFeed` test** — mocks `fetch` returning an envelope of one entry, asserts the formatted line renders. Implement `ActivityFeed` (client, TanStack Query) + `DashboardStats` (six tiles from `fetchStats`) + rewrite `page.tsx` to render both with the brand `StaffPageHeader`. Run → pass.
- [ ] **Step 6:** commit `feat(frontend): staff dashboard (stats + activity)`.

---

## Task 11: Province section (province + district CRUD)

**Files:**
- Create: `frontend/src/app/staff/provinces/page.tsx`, `.../provinces/new/page.tsx`, `.../provinces/[provinceId]/page.tsx` (districts under it), `.../provinces/[provinceId]/edit/page.tsx`
- Create: `frontend/src/components/ProvinceForm.tsx`, `DistrictForm.tsx`, `ProvinceAdminList.tsx`, `DistrictAdminList.tsx`
- Create: `frontend/src/lib/province-schema.ts`, `district-schema.ts`
- Test: form + list tests (mirror `HealerForm.test.tsx`, `HealerAdminList.test.tsx`)

**Interfaces:** consumes Task 8 mutations/keys. Forms use `staff-ui` classes and the branded panel.

- [ ] **Step 1: Failing test** — `ProvinceForm` shows "name is required" on empty submit; saves via `createProvince`.
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** province zod schema + form + list (add/edit/delete, 409 → "still has districts" message).
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5:** repeat Steps 1–4 for `DistrictForm`/`DistrictAdminList` (delete 409 → "still has healers"); the province detail page lists its districts with CRUD.
- [ ] **Step 6:** `npx tsc --noEmit && npx vitest run`; commit `feat(frontend): province & district CRUD section`.

---

## Task 12: Healer flat list + form district picker

**Files:**
- Create: `frontend/src/app/staff/healers/page.tsx` (flat list + district filter), `.../healers/new/page.tsx`, `.../healers/[healerId]/edit/page.tsx`
- Modify: `frontend/src/components/HealerAdminList.tsx` (flat: fetch all, add district-name column + filter prop), `HealerForm.tsx` (add district picker; drop the URL-provided `districtId`)
- Delete: `frontend/src/app/staff/districts/**` healer routes (moved)
- Test: update `HealerAdminList.test.tsx` (envelope already mocked), add `HealerForm` district-picker test.

**Interfaces:** `HealerForm` now takes `healer?` only and reads `districtId` from a picker (options from `listDistricts`).

- [ ] **Step 1: Failing test** — `HealerForm` requires a district selection; submitting sets `districtId`.
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** district picker (Base-UI combobox like `HerbPicker`, options from districts), flat list page with a `<select>` district filter driving `fetchHealers(districtId)`, and the new routes. Keep accessible names (`Edit`/`Delete`/`Cases`… ) so list tests hold.
- [ ] **Step 4: Run → pass.**
- [ ] **Step 5:** commit `feat(frontend): flat healer section + district picker`.

---

## Task 13: Remedy flat list + form healer picker

**Files:**
- Create: `frontend/src/app/staff/remedies/page.tsx` (flat + healer filter), `.../remedies/new/page.tsx`, `.../remedies/[remedyId]/edit/page.tsx`
- Modify: `RemedyAdminList.tsx` (flat: fetch all remedies, add healer column + filter), `RemedyForm.tsx` (add healer picker; drop URL `healerId`)
- Delete: old `/staff/healers/[healerId]/remedies/**`
- Test: update `RemedyAdminList.test.tsx`; add `RemedyForm` healer-picker test.

**Interfaces:** flat list uses `listRemedies` (already exists); `RemedyForm` gets `healerId` from a picker (options from `listHealers`).

- [ ] **Step 1–4:** failing `RemedyForm` picker test → implement picker + flat list + healer filter + routes → pass (mirror Task 12).
- [ ] **Step 5:** commit `feat(frontend): flat remedy section + healer picker`.

---

## Task 14: Case flat list + form remedy picker

**Files:**
- Create: `frontend/src/app/staff/cases/page.tsx` (flat + remedy filter), `.../cases/new/page.tsx`, `.../cases/[treatmentCaseId]/edit/page.tsx`
- Modify: `CaseAdminList.tsx` (flat: fetch all cases, add remedy column + filter), `CaseForm.tsx` (add remedy picker; derive `healerId` from the chosen remedy)
- Delete: old `/staff/remedies/[remedyId]/treatment-cases/**`
- Test: update `CaseAdminList.test.tsx`; add `CaseForm` remedy-picker test.

**Interfaces:** flat list uses `listTreatmentCases` (exists); `CaseForm` gets `remedyId` from a picker (options from `listRemedies`), and looks up `healerId` from the selected remedy.

- [ ] **Step 1–4:** failing `CaseForm` picker test → implement → pass (mirror Task 12). Keep `getByLabelText` targets (`/age/i`, `/date treated/i`, `/patient sex/i`) intact.
- [ ] **Step 5:** commit `feat(frontend): flat case section + remedy picker`.

---

## Task 15: Remove dead routes + reconcile

**Files:**
- Delete any now-unused nested staff route dirs and `StaffPageHeader` ancestor-crumb code paths that referenced them.
- Modify: `frontend/src/proxy.ts` only if it enumerated old paths (it guards `/staff/*` by prefix — likely no change).
- Verify no imports reference deleted files (`grep -rn "districts/\[districtId\]/healers"`).

- [ ] **Step 1:** delete leftover dirs; `grep` for dangling imports; fix.
- [ ] **Step 2:** `cd frontend && npx tsc --noEmit && npm run lint && npx vitest run`. Expected: all green.
- [ ] **Step 3:** commit `refactor(frontend): remove nested staff drill-down routes`.

---

## Task 16: Full verification + CONTEXT.md

- [ ] **Step 1:** `cd backend && go build ./... && go vet ./... && go test ./...` — all green.
- [ ] **Step 2:** `cd frontend && npx tsc --noEmit && npm run lint && npx vitest run && npm run build` — all green.
- [ ] **Step 3:** Optional live check: `docker compose watch`, open `/staff`, click each section, add/edit/delete a district and a healer, confirm the dashboard activity feed shows the events.
- [ ] **Step 4:** Update `CONTEXT.md`: domain model note (unchanged), Frontend layout tree (six sections, new components), new endpoints (healers flat, provinces/districts CRUD, activity, stats), event_log + audit read model, and a "Plan 13 — staff workspace sections" entry.
- [ ] **Step 5:** commit `docs: reconcile CONTEXT.md for staff workspace sections`.

---

## Self-Review

**Spec coverage:**
- §1 Nav/IA → Tasks 9, 12–15. ✔
- §2 flat healer endpoint → Task 3. ✔
- §3 province/district CRUD + events + guards → Tasks 4, 5, 6; frontend Task 11. ✔
- §4 activity read model (SubscribeAll, event_log, recorder, endpoint) → Tasks 1, 2; frontend Tasks 8, 10. ✔
- §5 stats → Task 7; frontend Tasks 8, 10. ✔
- §6 frontend structure → Tasks 8–15. ✔
- §7 testing → every task is TDD. ✔
- Deferred (Setting, activity filter, retention) → not planned, correct.

**Type consistency:** `Stats`/`Activity` shapes match between Task 2 (Go JSON), Task 8 (TS types), Task 10 (consumer). `fetchHealers(districtId?)`/`listHealers({districtId})` names align across Tasks 3, 8, 12. `LocationService` method names align across Tasks 4–6. Event names (`province.created` …) align between Task 4 and Task 10's `formatActivity`.

**Placeholder scan:** no TBD/"handle edge cases"; each task names exact files, routes, signatures, and test intent. Boilerplate steps reference the exact existing file to mirror (a real pattern, not an intra-plan "similar to Task N").
