# Staff Workspace — Entity Sections, Location CRUD & Activity Feed Design

Date: 2026-08-15
Status: Approved for planning
Scope: One increment. Restructures the staff zone from a nested
District→Healer→Remedy→Case drill-down into six flat, entity-first sections,
adds province/district CRUD, and adds a persisted activity feed for a new
dashboard. The domain model is unchanged.

## Goal

Today staff reach a record only by walking the hierarchy (pick a district → its
healers → a healer's remedies → a remedy's cases). As the data grows this is slow
and hides the whole picture. This increment gives each entity its own top-level
section and a dashboard overview:

1. **Six-section nav** — Dashboard · Province · Healer · Remedy · Case · Herb.
   Each entity is a flat, searchable, filterable list, not a leaf of a tree.
2. **Province/District CRUD** — provinces and districts become editable records
   (they are seed-only today), so a second province can be added in-app.
3. **Dashboard** — six record counts plus a **recent-activity feed** built from
   persisted domain events.

Non-goals (see "Deferred"): the Setting section, per-entity soft delete,
activity filtering/search, real-time push, province switching in the public
zone, multi-province seed data.

## Domain model — UNCHANGED

`Province 1→n District 1→n Healer 1→n Remedy 1→n Case`; `Herb n↔m Remedy`.
A healer still belongs to exactly one district (`healer.district_id` stays). This
increment changes navigation and adds write/read endpoints; it does **not**
change any relationship. (An earlier n↔m healer↔district idea was rejected.)

## Constraints

- **Clean Architecture**: `domain ← usecase ← adapter/platform` preserved. New
  location write logic and the activity read model carry no framework code in
  `domain`.
- **Event-driven**: every write publishes a domain event. Province/District
  writes gain events (`province.created` … `district.deleted`). The activity
  feed is a **read model fed by a bus subscriber** — the write path does not know
  the feed exists. Reads publish no events.
- **15-Factor**: no new config, no new backing service. `event_log` lives in the
  existing Postgres. Page-size caps stay compile-time constants.
- **Full-English REST route names** under `/api/v1`.
- **TDD mandatory**: every layer built failing-test-first.

## 1. Navigation & information architecture

The staff sidebar becomes six items (Setting is deferred):

| # | Section  | Route            | Content |
|---|----------|------------------|---------|
| 1 | Dashboard| `/staff`         | 6 counts + recent activity |
| 2 | Province | `/staff/provinces` | province list + district management (CRUD) |
| 3 | Healer   | `/staff/healers` | flat list, filter by district |
| 4 | Remedy   | `/staff/remedies`| flat list, filter by healer |
| 5 | Case     | `/staff/cases`   | flat list, filter by remedy |
| 6 | Herb     | `/staff/herbs`   | shared library (unchanged) |

The nested routes (`/staff/districts/[districtId]/…`,
`/staff/healers/[healerId]/remedies/…`,
`/staff/remedies/[remedyId]/treatment-cases/…`) are removed and replaced by the
flat routes above. Because a record is no longer reached through its parent, each
**create form gains a parent picker**: new healer → district, new remedy →
healer, new case → remedy. Edit/delete are unchanged.

`StaffNavLink` gains the four new sections; the active rule matches the section
prefix. `StaffPageHeader` keeps the eyebrow + serif title; breadcrumbs shorten to
`Section / record` (no ancestor chain).

## 2. Flat healer list — new endpoint

Only healers lack a flat list endpoint (remedies, cases, herbs already have one).

- `GET /api/v1/healers?districtId={id}&page&pageSize` → `Page[Healer]`.
  `districtId` optional; absent = all healers in the (single) province.
- Repository: `ListHealer(ctx, params, districtID *int64)` + `CountHealer(ctx,
  districtID *int64)` — one sqlc query pair with an optional `WHERE district_id`.
- Use case: `HealerService.List(ctx, params, districtID *int64) (Page[Healer])`.
- The existing `GET /districts/{districtId}/healers` stays for the public site.
- Public (read) route, consistent with the other flat lists.

Healer **write** is unchanged (already takes `districtId`); only the form UX adds
a picker.

## 3. Province & District CRUD

`domain/location` gains write behavior and events. The `Repository` interface
grows (writes + guards):

```
CreateProvince / UpdateProvince / DeleteProvince
GetProvince(id)                       // for the edit form
CountDistrictByProvince(provinceID)   // delete guard
CreateDistrict / UpdateDistrict / DeleteDistrict
CountHealerByDistrict(districtID)     // delete guard
```

Sentinel errors added to `location`: `ErrProvinceNotFound`,
`ErrProvinceReferenced` (has districts), `ErrDistrictReferenced` (has healers).
`ErrNotFound` (district) stays.

**Events** (new `location` event types, one file): `ProvinceCreated/Updated/
Deleted`, `DistrictCreated/Updated/Deleted`, each carrying the id (+ names).
`LocationService` publishes them, mirroring `HealerService`.

**Delete guards**: deleting a province with districts → `ErrProvinceReferenced`
→ HTTP 409; deleting a district with healers → `ErrDistrictReferenced` → 409.

**Routes** (writes protected; reads already public):

```
protected  POST   /api/v1/provinces
protected  PUT    /api/v1/provinces/:provinceId
protected  DELETE /api/v1/provinces/:provinceId
public     GET    /api/v1/provinces/:provinceId          (new — edit form)
protected  POST   /api/v1/districts                       (body: provinceId, names)
protected  PUT    /api/v1/districts/:districtId
protected  DELETE /api/v1/districts/:districtId
```

`GET /api/v1/provinces` and `/provinces/:provinceId/districts` already exist.

## 4. Activity feed — persisted event read model

The bus is synchronous, in-process, and today only logs events (they do not
survive a restart). Add a durable read model:

- **Table** `event_log(id bigserial pk, event_name text, payload jsonb,
  occurred_at timestamptz default now())`. Migration only; no entity coupling.
- **Bus** gains `SubscribeAll(handler)` — handlers run for *every* published
  event (a `""`-keyed slice run by `Publish` in addition to name-keyed handlers).
  Small, backward-compatible addition.
- **Audit subscriber** — a `usecase/audit.Recorder` subscribed via `SubscribeAll`
  and backed by an `EventLog` write port implemented in `adapter/repository`
  (Clean-Architecture: application logic in `usecase`, SQL in `adapter`). On every
  event it records a row with `event_name = e.EventName()` and `payload =
  json.Marshal(e)`. Non-invasive — event types are not modified; their exported
  fields (id, name/title) land in `payload`. Handler errors are logged, not
  returned (bus contract).
- **Read**: `GET /api/v1/activity?page&pageSize` (protected) → `Page[Activity]`
  where `Activity = { id, eventName, occurredAt, payload }`, newest first.
- **Frontend** maps `eventName` → a verb ("added"/"updated"/"deleted") and pulls
  a title from `payload` for the feed line.

`withinlazy:` `event_log` grows unbounded — add retention/pruning if it matters.

## 5. Dashboard stats — one aggregate endpoint

- `GET /api/v1/stats` (protected) → `{ provinces, districts, healers, remedies,
  cases, herbs }`. Backed by the `Count*` queries added in Plan 11 (+ new
  province/district counts), aggregated by a `StatsService`. One call, not six.

## 6. Frontend structure

- **Shell**: sidebar → six sections; remove the district drill-down. Dashboard is
  the staff landing (`/staff`).
- **Dashboard** (`/staff`): six stat tiles from `GET /stats`; activity list from
  `GET /activity` (client component, TanStack Query).
- **Province** (`/staff/provinces`): province list with add/edit/delete; each
  province expands to its districts with add/edit/delete. Delete shows the 409
  guard message ("still has districts/healers").
- **Healer/Remedy/Case**: flat list pages + parent filter (a `<select>` /
  Base-UI combobox). Create/edit forms move under `/staff/{healers,remedies,
  cases}` and gain a **parent picker** (reusing the `HerbPicker` combobox
  pattern for district/healer/remedy selection).
- **api layer**: `api.ts` gains `listHealers`, `getProvince`, `listActivity`,
  `getStats`; `staff-queries.ts` gains the flat fetchers + province/district
  mutations; new BFF routes `/bff/provinces`, `/bff/districts` (cookie → Bearer).
- **Types**: add `Activity`, `Stats`; `Province`/`District` already typed.

## 7. Testing (TDD, every layer)

- Backend: repo integration (flat healer list + filter; province/district
  create/update/delete + guards; `event_log` insert on publish; activity paged
  read; stats counts). Use case tests (event published on each write; guard
  errors). Handler tests (new routes, 409 on guarded delete, body validation).
  Bus test for `SubscribeAll`.
- Frontend: api-client tests (new fetchers unwrap the envelope); Dashboard
  (renders counts + activity); Province CRUD; each flat list + filter; each form
  parent picker; `StaffNavLink` active for the new sections.

## Deferred

- **Setting** section (account/password, appearance) — explicitly out for now.
- Activity **filtering/search**, retention/pruning, real-time updates.
- Pagination controls on the dashboard activity list (show recent N only).
- Public-zone changes (still browses by district; a flat public healer list is
  not required by this increment).
- Soft delete / audit of *who* made a change (event_log records what, not who).

## Route summary (new/changed only)

```
GET    /api/v1/healers?districtId=&page&pageSize     (new, public)
GET    /api/v1/provinces/:provinceId                 (new, public)
POST   /api/v1/provinces                             (new, protected)
PUT    /api/v1/provinces/:provinceId                 (new, protected)
DELETE /api/v1/provinces/:provinceId                 (new, protected, 409 guard)
POST   /api/v1/districts                             (new, protected)
PUT    /api/v1/districts/:districtId                 (new, protected)
DELETE /api/v1/districts/:districtId                 (new, protected, 409 guard)
GET    /api/v1/activity?page&pageSize                (new, protected)
GET    /api/v1/stats                                 (new, protected)
```
