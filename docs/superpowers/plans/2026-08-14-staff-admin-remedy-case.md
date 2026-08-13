# Staff Admin — Remedy + Treatment Case Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff manage remedies (under a healer) and treatment cases (under a remedy) in the browser, reusing the auth + BFF + TanStack-Query-form pattern established for healers.

**Architecture:** Identical to the healer admin (Plan 6). Client components use TanStack Query (`useQuery` reads via the `/api` proxy, `useMutation` writes → `/bff/*`); `/bff/*` route handlers read the httpOnly `session` cookie and forward to the Go API with `Authorization: Bearer` (`bff-forward.ts` + `getSessionToken`). Forms use react-hook-form + zod. All new pages live under the guarded `/staff/*` tree.

**Tech Stack:** Next.js App Router + TS, Tailwind, shadcn/ui, @tanstack/react-query, react-hook-form, zod, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-08-13-thai-folk-medicine-design.md` (§7.2 write routes). Backend (guarded): `POST/PUT/DELETE /api/v1/remedies`, `POST/PUT/DELETE /api/v1/treatment-cases`. Public reads: `GET /api/v1/healers/{id}/remedies`, `GET /api/v1/remedies/{id}`, `GET /api/v1/remedies/{id}/treatment-cases`, `GET /api/v1/treatment-cases/{id}`.

## Global Constraints

- **Reuse the existing seams:** `bffForward` (`src/lib/bff-forward.ts`), `getSessionToken` (`src/lib/session.ts`), the `Providers` QueryClient, `EmptyState`, and the healer admin shape are the templates. Do NOT re-invent them.
- **Auth via BFF, token never in the browser.** Every write goes browser → `/bff/*` route handler (reads cookie, adds Bearer) → Go. Each write route handler calls `getSessionToken()` and returns 401 without a token. Reads use the public `/api` proxy (no auth).
- **BFF prefix `/bff/*`** (not `/api/*`). New: `/bff/remedies`, `/bff/remedies/[remedyId]`, `/bff/treatment-cases`, `/bff/treatment-cases/[treatmentCaseId]`.
- **Mutations invalidate their list query** so lists refresh. **Delete mutations MUST surface a failure** (render an error message on `mutation.isError`) — a delete can 409 (a remedy with cases; the backend maps the FK violation). Do not repeat the silent-failure bug.
- **Contract fit:**
  - Remedy create payload `{healerId, name, symptoms, ingredients, preparationMethod, usage, note}`; update payload `{name, symptoms, ingredients, preparationMethod, usage, note}` (a remedy keeps its healer — no `healerId` on update).
  - Case create payload `{remedyId, healerId, patientAge, patientSex, symptoms, result, note, treatedOn}`; update payload `{patientAge, patientSex, symptoms, result, note, treatedOn}` (a case keeps its remedy/healer). `treatedOn` is an ISO date string `YYYY-MM-DD` (use `<input type="date">`; the backend accepts/returns that format). `patientAge` is a number ≥ 0.
- **Validation at the form boundary** with zod; the Go use case is the real validator (400 → field error, 409 → conflict message).
- **TDD (adapted):** zod schemas + query helpers → Vitest unit; forms/lists → RTL (mock fetch, wrap in QueryClientProvider); pages get a smoke check.
- **Accessibility:** labels tied to inputs, real buttons, error text.
- **Commits:** Conventional Commits, one per task. **Branch:** `feat/staff-admin-remedy-case`. No secrets committed.

---

### Task 1: Remedy admin — schema, queries, BFF, list, form, pages

**Files:**
- Create: `frontend/src/lib/remedy-schema.ts` + `frontend/src/lib/remedy-schema.test.ts`
- Modify: `frontend/src/lib/staff-queries.ts` (remedy keys + fetchers)
- Create: `frontend/src/app/bff/remedies/route.ts` (POST)
- Create: `frontend/src/app/bff/remedies/[remedyId]/route.ts` (PUT, DELETE)
- Create: `frontend/src/components/RemedyAdminList.tsx` + `.test.tsx`
- Create: `frontend/src/components/RemedyForm.tsx` + `.test.tsx`
- Create: `frontend/src/app/staff/healers/[healerId]/remedies/page.tsx`
- Create: `frontend/src/app/staff/healers/[healerId]/remedies/new/page.tsx`
- Create: `frontend/src/app/staff/healers/[healerId]/remedies/[remedyId]/edit/page.tsx`
- Modify: `frontend/src/components/HealerAdminList.tsx` (add a "Remedies" link per healer)

**Interfaces:**
- Produces: `remedySchema` (zod) — `name` required; `symptoms`, `ingredients`, `preparationMethod`, `usage`, `note` plain strings; `RemedyInput` type.
- Produces (in `staff-queries.ts`): `remedyListKey(healerId)`, `fetchRemedies(healerId)`, `createRemedy(input & {healerId})`, `updateRemedy(id, input)`, `deleteRemedy(id)`.
- Produces: `POST /bff/remedies`, `PUT`+`DELETE /bff/remedies/{remedyId}`.
- Produces: `RemedyAdminList({ healerId })`, `RemedyForm({ healerId, remedy? })`.

- [ ] **Step 1: Write the failing remedy-schema test**

Create `frontend/src/lib/remedy-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { remedySchema } from "./remedy-schema";

describe("remedySchema", () => {
  it("requires a name", () => {
    expect(
      remedySchema.safeParse({ name: "", symptoms: "", ingredients: "", preparationMethod: "", usage: "", note: "" })
        .success,
    ).toBe(false);
  });

  it("accepts a minimal remedy", () => {
    expect(
      remedySchema.safeParse({ name: "ยาต้ม", symptoms: "", ingredients: "", preparationMethod: "", usage: "", note: "" })
        .success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm test src/lib/remedy-schema.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the schema**

Create `frontend/src/lib/remedy-schema.ts`:

```ts
import { z } from "zod";

export const remedySchema = z.object({
  name: z.string().min(1, "Name is required"),
  symptoms: z.string(),
  ingredients: z.string(),
  preparationMethod: z.string(),
  usage: z.string(),
  note: z.string(),
});

export type RemedyInput = z.infer<typeof remedySchema>;
```

- [ ] **Step 4: Add the remedy query helpers**

Append to `frontend/src/lib/staff-queries.ts`:

```ts
import type { Remedy } from "@/lib/api-types";
import type { RemedyInput } from "@/lib/remedy-schema";

export function remedyListKey(healerId: number) {
  return ["remedies", healerId] as const;
}

/** fetchRemedies reads a healer's remedies through the same-origin /api proxy. */
export async function fetchRemedies(healerId: number): Promise<Remedy[]> {
  const res = await fetch(`/api/v1/healers/${healerId}/remedies`, { cache: "no-store" });
  if (!res.ok) throw new Error("cannot load remedies");
  return (await res.json()) as Remedy[];
}

/** createRemedy posts a new remedy (with its healerId) through the BFF. */
export async function createRemedy(input: RemedyInput & { healerId: number }): Promise<void> {
  const res = await fetch("/bff/remedies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("cannot create remedy");
}

/** updateRemedy PUTs changes to a remedy through the BFF (no healer change). */
export async function updateRemedy(id: number, input: RemedyInput): Promise<void> {
  const res = await fetch(`/bff/remedies/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("cannot update remedy");
}

/** deleteRemedy removes a remedy through the BFF. */
export async function deleteRemedy(id: number): Promise<void> {
  const res = await fetch(`/bff/remedies/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("cannot delete remedy");
}
```

Note: `staff-queries.ts` already imports `Healer` and `HealerInput`; add the `Remedy`/`RemedyInput` imports next to them (organized import order). If `import type { Remedy }` collides with an existing import line, merge into the existing `@/lib/api-types` import.

- [ ] **Step 5: Write the BFF remedy routes**

Create `frontend/src/app/bff/remedies/route.ts`:

```ts
import { NextResponse } from "next/server";

import { bffForward } from "@/lib/bff-forward";
import { getSessionToken } from "@/lib/session";

export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { status, data } = await bffForward("POST", "/remedies", token, body);
  return NextResponse.json(data ?? {}, { status });
}
```

Create `frontend/src/app/bff/remedies/[remedyId]/route.ts`:

```ts
import { NextResponse } from "next/server";

import { bffForward } from "@/lib/bff-forward";
import { getSessionToken } from "@/lib/session";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ remedyId: string }> },
) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const { remedyId } = await params;
  const body = await request.json().catch(() => null);
  const { status, data } = await bffForward("PUT", `/remedies/${remedyId}`, token, body);
  return NextResponse.json(data ?? {}, { status });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ remedyId: string }> },
) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const { remedyId } = await params;
  const { status, data } = await bffForward("DELETE", `/remedies/${remedyId}`, token);
  if (status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(data ?? {}, { status });
}
```

- [ ] **Step 6: Write the failing RemedyAdminList test**

Create `frontend/src/components/RemedyAdminList.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RemedyAdminList } from "./RemedyAdminList";

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("RemedyAdminList", () => {
  it("lists remedies with edit, cases, and delete controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => [{ id: 5, healerId: 2, name: "ยาต้ม" }] })) as unknown as typeof fetch,
    );
    renderWithClient(<RemedyAdminList healerId={2} />);
    expect(await screen.findByText("ยาต้ม")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /edit/i })).toHaveAttribute(
      "href",
      "/staff/healers/2/remedies/5/edit",
    );
    expect(screen.getByRole("link", { name: /cases/i })).toHaveAttribute(
      "href",
      "/staff/remedies/5/treatment-cases",
    );
  });

  it("shows an error and keeps the row when delete fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, opts?: { method?: string }) => {
        if (opts?.method === "DELETE") return { ok: false, status: 409 };
        return { ok: true, json: async () => [{ id: 5, healerId: 2, name: "ยาต้ม" }] };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<RemedyAdminList healerId={2} />);
    await screen.findByText("ยาต้ม");
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(await screen.findByText(/could not delete/i)).toBeInTheDocument();
    expect(screen.getByText("ยาต้ม")).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `cd frontend && pnpm test src/components/RemedyAdminList.test.tsx`
Expected: FAIL (`RemedyAdminList` not found).

- [ ] **Step 8: Write the RemedyAdminList component**

Create `frontend/src/components/RemedyAdminList.tsx`:

```tsx
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { deleteRemedy, fetchRemedies, remedyListKey } from "@/lib/staff-queries";

export function RemedyAdminList({ healerId }: { healerId: number }) {
  const queryClient = useQueryClient();
  const { data: remedies, isLoading, isError } = useQuery({
    queryKey: remedyListKey(healerId),
    queryFn: () => fetchRemedies(healerId),
  });

  const remove = useMutation({
    mutationFn: deleteRemedy,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: remedyListKey(healerId) }),
  });

  if (isLoading) return <p className="text-stone-500">Loading…</p>;
  if (isError) return <p className="text-red-600">Could not load remedies.</p>;

  return (
    <div className="space-y-4">
      <Link
        href={`/staff/healers/${healerId}/remedies/new`}
        className="inline-block rounded bg-stone-800 px-3 py-2 text-sm text-white"
      >
        + New remedy
      </Link>
      {remove.isError ? (
        <p className="text-red-600">Could not delete this remedy. It may still have treatment cases.</p>
      ) : null}
      {!remedies || remedies.length === 0 ? (
        <EmptyState message="No remedies for this healer yet." />
      ) : (
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {remedies.map((r) => (
            <li key={r.id} className="flex items-center justify-between p-3">
              <p className="font-medium">{r.name}</p>
              <div className="flex items-center gap-3 text-sm">
                <Link href={`/staff/remedies/${r.id}/treatment-cases`} className="text-stone-700 underline">
                  Cases
                </Link>
                <Link
                  href={`/staff/healers/${healerId}/remedies/${r.id}/edit`}
                  className="text-stone-700 underline"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => remove.mutate(r.id)}
                  disabled={remove.isPending}
                  className="text-red-600 underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `cd frontend && pnpm test src/components/RemedyAdminList.test.tsx`
Expected: PASS.

- [ ] **Step 10: Write the failing RemedyForm test**

Create `frontend/src/components/RemedyForm.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { RemedyForm } from "./RemedyForm";

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("RemedyForm (create)", () => {
  it("validates the required name", async () => {
    renderWithClient(<RemedyForm healerId={2} />);
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });

  it("posts a new remedy and navigates back", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ id: 9 }) }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    renderWithClient(<RemedyForm healerId={2} />);
    await userEvent.type(screen.getByLabelText(/name/i), "ยาต้ม");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/bff/remedies", expect.objectContaining({ method: "POST" })),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/staff/healers/2/remedies"));
  });
});
```

- [ ] **Step 11: Run the test to verify it fails**

Run: `cd frontend && pnpm test src/components/RemedyForm.test.tsx`
Expected: FAIL (`RemedyForm` not found).

- [ ] **Step 12: Write the RemedyForm component**

Create `frontend/src/components/RemedyForm.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import type { Remedy } from "@/lib/api-types";
import { remedySchema, type RemedyInput } from "@/lib/remedy-schema";
import { createRemedy, remedyListKey, updateRemedy } from "@/lib/staff-queries";

export function RemedyForm({ healerId, remedy }: { healerId: number; remedy?: Remedy }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RemedyInput>({
    resolver: zodResolver(remedySchema),
    defaultValues: {
      name: remedy?.name ?? "",
      symptoms: remedy?.symptoms ?? "",
      ingredients: remedy?.ingredients ?? "",
      preparationMethod: remedy?.preparationMethod ?? "",
      usage: remedy?.usage ?? "",
      note: remedy?.note ?? "",
    },
  });

  const save = useMutation({
    mutationFn: (values: RemedyInput) =>
      remedy ? updateRemedy(remedy.id, values) : createRemedy({ ...values, healerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: remedyListKey(healerId) });
      router.push(`/staff/healers/${healerId}/remedies`);
      router.refresh();
    },
  });

  const field = "w-full rounded border border-stone-300 p-2";

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} className="max-w-lg space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">
          Name (ชื่อตำรับยา)
        </label>
        <input id="name" className={field} {...register("name")} />
        {errors.name ? <p className="text-sm text-red-600">{errors.name.message}</p> : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="symptoms" className="text-sm font-medium">
          Symptoms treated (สรรพคุณ)
        </label>
        <textarea id="symptoms" rows={2} className={field} {...register("symptoms")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="ingredients" className="text-sm font-medium">
          Ingredients (ตัวยา)
        </label>
        <textarea id="ingredients" rows={2} className={field} {...register("ingredients")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="preparationMethod" className="text-sm font-medium">
          Preparation (วิธีปรุง)
        </label>
        <textarea id="preparationMethod" rows={2} className={field} {...register("preparationMethod")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="usage" className="text-sm font-medium">
          Usage (วิธีใช้)
        </label>
        <textarea id="usage" rows={2} className={field} {...register("usage")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="note" className="text-sm font-medium">
          Note (หมายเหตุ)
        </label>
        <textarea id="note" rows={2} className={field} {...register("note")} />
      </div>
      {save.isError ? <p className="text-sm text-red-600">Could not save. Try again.</p> : null}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded bg-stone-800 px-4 py-2 text-white disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => router.push(`/staff/healers/${healerId}/remedies`)}
          className="rounded border border-stone-300 px-4 py-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 13: Run the test to verify it passes**

Run: `cd frontend && pnpm test src/components/RemedyForm.test.tsx`
Expected: PASS.

- [ ] **Step 14: Write the remedy pages**

Create `frontend/src/app/staff/healers/[healerId]/remedies/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { RemedyAdminList } from "@/components/RemedyAdminList";
import { getHealer } from "@/lib/api";

export default async function StaffRemediesPage({
  params,
}: {
  params: Promise<{ healerId: string }>;
}) {
  const { healerId } = await params;
  const id = Number(healerId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const healer = await getHealer(id);
  if (!healer) notFound();

  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">Remedies of {healer.fullName}</h1>
      <RemedyAdminList healerId={id} />
    </section>
  );
}
```

Create `frontend/src/app/staff/healers/[healerId]/remedies/new/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { RemedyForm } from "@/components/RemedyForm";

export default async function NewRemedyPage({
  params,
}: {
  params: Promise<{ healerId: string }>;
}) {
  const { healerId } = await params;
  const id = Number(healerId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">New remedy</h1>
      <RemedyForm healerId={id} />
    </section>
  );
}
```

Create `frontend/src/app/staff/healers/[healerId]/remedies/[remedyId]/edit/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { RemedyForm } from "@/components/RemedyForm";
import { getRemedy } from "@/lib/api";

export default async function EditRemedyPage({
  params,
}: {
  params: Promise<{ healerId: string; remedyId: string }>;
}) {
  const { healerId, remedyId } = await params;
  const hId = Number(healerId);
  const rId = Number(remedyId);
  if (!Number.isInteger(hId) || hId <= 0 || !Number.isInteger(rId) || rId <= 0) notFound();

  const remedy = await getRemedy(rId);
  if (!remedy) notFound();

  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">Edit remedy</h1>
      <RemedyForm healerId={hId} remedy={remedy} />
    </section>
  );
}
```

- [ ] **Step 15: Add a "Remedies" link to the healer list**

In `frontend/src/components/HealerAdminList.tsx`, add a link (next to Edit/Delete) that opens the healer's remedies:

```tsx
                <Link
                  href={`/staff/healers/${h.id}/remedies`}
                  className="text-stone-700 underline"
                >
                  Remedies
                </Link>
```

Place it inside the existing per-row controls `<div className="flex items-center gap-3 text-sm">`, before the Edit link. (Do not change the existing test expectations; the Edit link and Delete button stay.)

- [ ] **Step 16: Verify tests, lint, build**

Run: `cd frontend && pnpm test && pnpm lint && pnpm build`
Expected: remedy schema/list/form tests PASS (plus all prior); lint clean; build succeeds (new /staff and /bff routes compile).

- [ ] **Step 17: Commit** (orchestrator commits.)

---

### Task 2: Treatment case admin — schema, queries, BFF, list, form, pages

**Files:**
- Create: `frontend/src/lib/treatment-case-schema.ts` + `.test.ts`
- Modify: `frontend/src/lib/api.ts` (add `getTreatmentCase`)
- Modify: `frontend/src/lib/staff-queries.ts` (case keys + fetchers)
- Create: `frontend/src/app/bff/treatment-cases/route.ts` (POST)
- Create: `frontend/src/app/bff/treatment-cases/[treatmentCaseId]/route.ts` (PUT, DELETE)
- Create: `frontend/src/components/CaseAdminList.tsx` + `.test.tsx`
- Create: `frontend/src/components/CaseForm.tsx` + `.test.tsx`
- Create: `frontend/src/app/staff/remedies/[remedyId]/treatment-cases/page.tsx`
- Create: `frontend/src/app/staff/remedies/[remedyId]/treatment-cases/new/page.tsx`
- Create: `frontend/src/app/staff/remedies/[remedyId]/treatment-cases/[treatmentCaseId]/edit/page.tsx`

**Interfaces:**
- Produces: `treatmentCaseSchema` (zod) — `patientAge` number ≥ 0 (coerced), `patientSex` required, `treatedOn` `YYYY-MM-DD` required, `symptoms`/`result`/`note` plain strings; `TreatmentCaseInput` type.
- Produces: `api.getTreatmentCase(id): Promise<TreatmentCase | null>`.
- Produces (in `staff-queries.ts`): `caseListKey(remedyId)`, `fetchCases(remedyId)`, `createCase(input & {remedyId, healerId})`, `updateCase(id, input)`, `deleteCase(id)`.
- Produces: `POST /bff/treatment-cases`, `PUT`+`DELETE /bff/treatment-cases/{treatmentCaseId}`.
- Produces: `CaseAdminList({ remedyId })`, `CaseForm({ remedyId, healerId, treatmentCase? })`.

- [ ] **Step 1: Write the failing schema test**

Create `frontend/src/lib/treatment-case-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { treatmentCaseSchema } from "./treatment-case-schema";

const base = { patientAge: 40, patientSex: "female", symptoms: "", result: "", note: "", treatedOn: "2026-03-01" };

describe("treatmentCaseSchema", () => {
  it("accepts a valid case", () => {
    expect(treatmentCaseSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an empty patientSex", () => {
    expect(treatmentCaseSchema.safeParse({ ...base, patientSex: "" }).success).toBe(false);
  });

  it("rejects a negative age", () => {
    expect(treatmentCaseSchema.safeParse({ ...base, patientAge: -1 }).success).toBe(false);
  });

  it("rejects a missing date", () => {
    expect(treatmentCaseSchema.safeParse({ ...base, treatedOn: "" }).success).toBe(false);
  });

  it("coerces a numeric-string age", () => {
    const parsed = treatmentCaseSchema.safeParse({ ...base, patientAge: "50" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.patientAge).toBe(50);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm test src/lib/treatment-case-schema.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the schema**

Create `frontend/src/lib/treatment-case-schema.ts`:

```ts
import { z } from "zod";

export const treatmentCaseSchema = z.object({
  patientAge: z.coerce.number().int().min(0, "Age must be 0 or more"),
  patientSex: z.string().min(1, "Patient sex is required"),
  symptoms: z.string(),
  result: z.string(),
  note: z.string(),
  treatedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
});

export type TreatmentCaseInput = z.infer<typeof treatmentCaseSchema>;
```

- [ ] **Step 4: Add `getTreatmentCase` to the public API client**

Append to `frontend/src/lib/api.ts` (using the existing `getOrNull` helper):

```ts
export async function getTreatmentCase(id: number): Promise<TreatmentCase | null> {
  return getOrNull<TreatmentCase>(`/treatment-cases/${id}`);
}
```

Note: `TreatmentCase` is already imported in `api.ts` (it types `listCasesByRemedy`). Reuse that import.

- [ ] **Step 5: Add the case query helpers**

Append to `frontend/src/lib/staff-queries.ts`:

```ts
import type { TreatmentCase } from "@/lib/api-types";
import type { TreatmentCaseInput } from "@/lib/treatment-case-schema";

export function caseListKey(remedyId: number) {
  return ["treatment-cases", remedyId] as const;
}

/** fetchCases reads a remedy's treatment cases through the /api proxy. */
export async function fetchCases(remedyId: number): Promise<TreatmentCase[]> {
  const res = await fetch(`/api/v1/remedies/${remedyId}/treatment-cases`, { cache: "no-store" });
  if (!res.ok) throw new Error("cannot load treatment cases");
  return (await res.json()) as TreatmentCase[];
}

/** createCase posts a new case (with remedyId + healerId) through the BFF. */
export async function createCase(
  input: TreatmentCaseInput & { remedyId: number; healerId: number },
): Promise<void> {
  const res = await fetch("/bff/treatment-cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("cannot create treatment case");
}

/** updateCase PUTs changes to a case through the BFF (no remedy/healer change). */
export async function updateCase(id: number, input: TreatmentCaseInput): Promise<void> {
  const res = await fetch(`/bff/treatment-cases/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("cannot update treatment case");
}

/** deleteCase removes a case through the BFF. */
export async function deleteCase(id: number): Promise<void> {
  const res = await fetch(`/bff/treatment-cases/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("cannot delete treatment case");
}
```

- [ ] **Step 6: Write the BFF case routes**

Create `frontend/src/app/bff/treatment-cases/route.ts`:

```ts
import { NextResponse } from "next/server";

import { bffForward } from "@/lib/bff-forward";
import { getSessionToken } from "@/lib/session";

export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { status, data } = await bffForward("POST", "/treatment-cases", token, body);
  return NextResponse.json(data ?? {}, { status });
}
```

Create `frontend/src/app/bff/treatment-cases/[treatmentCaseId]/route.ts`:

```ts
import { NextResponse } from "next/server";

import { bffForward } from "@/lib/bff-forward";
import { getSessionToken } from "@/lib/session";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ treatmentCaseId: string }> },
) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const { treatmentCaseId } = await params;
  const body = await request.json().catch(() => null);
  const { status, data } = await bffForward("PUT", `/treatment-cases/${treatmentCaseId}`, token, body);
  return NextResponse.json(data ?? {}, { status });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ treatmentCaseId: string }> },
) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const { treatmentCaseId } = await params;
  const { status, data } = await bffForward("DELETE", `/treatment-cases/${treatmentCaseId}`, token);
  if (status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(data ?? {}, { status });
}
```

- [ ] **Step 7: Write the failing CaseAdminList test**

Create `frontend/src/components/CaseAdminList.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaseAdminList } from "./CaseAdminList";

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CaseAdminList", () => {
  it("lists cases with an edit link and a date", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          { id: 8, remedyId: 5, healerId: 2, patientAge: 40, patientSex: "female", treatedOn: "2026-03-01", symptoms: "", result: "", note: "" },
        ],
      })) as unknown as typeof fetch,
    );
    renderWithClient(<CaseAdminList remedyId={5} />);
    expect(await screen.findByText(/1 March 2026/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /edit/i })).toHaveAttribute(
      "href",
      "/staff/remedies/5/treatment-cases/8/edit",
    );
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `cd frontend && pnpm test src/components/CaseAdminList.test.tsx`
Expected: FAIL (`CaseAdminList` not found).

- [ ] **Step 9: Write the CaseAdminList component**

Create `frontend/src/components/CaseAdminList.tsx`:

```tsx
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { formatThaiDate, patientSexLabel } from "@/lib/format";
import { caseListKey, deleteCase, fetchCases } from "@/lib/staff-queries";

export function CaseAdminList({ remedyId }: { remedyId: number }) {
  const queryClient = useQueryClient();
  const { data: cases, isLoading, isError } = useQuery({
    queryKey: caseListKey(remedyId),
    queryFn: () => fetchCases(remedyId),
  });

  const remove = useMutation({
    mutationFn: deleteCase,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: caseListKey(remedyId) }),
  });

  if (isLoading) return <p className="text-stone-500">Loading…</p>;
  if (isError) return <p className="text-red-600">Could not load treatment cases.</p>;

  return (
    <div className="space-y-4">
      <Link
        href={`/staff/remedies/${remedyId}/treatment-cases/new`}
        className="inline-block rounded bg-stone-800 px-3 py-2 text-sm text-white"
      >
        + New treatment case
      </Link>
      {remove.isError ? <p className="text-red-600">Could not delete this case.</p> : null}
      {!cases || cases.length === 0 ? (
        <EmptyState message="No treatment cases for this remedy yet." />
      ) : (
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {cases.map((c) => (
            <li key={c.id} className="flex items-center justify-between p-3">
              <div>
                <p className="font-medium">
                  {formatThaiDate(c.treatedOn)} · {patientSexLabel(c.patientSex)}, age {c.patientAge}
                </p>
                {c.result ? <p className="text-sm text-stone-500">{c.result}</p> : null}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Link
                  href={`/staff/remedies/${remedyId}/treatment-cases/${c.id}/edit`}
                  className="text-stone-700 underline"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => remove.mutate(c.id)}
                  disabled={remove.isPending}
                  className="text-red-600 underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `cd frontend && pnpm test src/components/CaseAdminList.test.tsx`
Expected: PASS.

- [ ] **Step 11: Write the failing CaseForm test**

Create `frontend/src/components/CaseForm.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { CaseForm } from "./CaseForm";

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CaseForm (create)", () => {
  it("requires patient sex and a date", async () => {
    renderWithClient(<CaseForm remedyId={5} healerId={2} />);
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/patient sex is required/i)).toBeInTheDocument();
  });

  it("posts a new case and navigates back", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ id: 9 }) }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    renderWithClient(<CaseForm remedyId={5} healerId={2} />);
    await userEvent.type(screen.getByLabelText(/patient sex/i), "female");
    await userEvent.type(screen.getByLabelText(/age/i), "40");
    await userEvent.type(screen.getByLabelText(/date treated/i), "2026-03-01");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/bff/treatment-cases", expect.objectContaining({ method: "POST" })),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/staff/remedies/5/treatment-cases"));
  });
});
```

- [ ] **Step 12: Run the test to verify it fails**

Run: `cd frontend && pnpm test src/components/CaseForm.test.tsx`
Expected: FAIL (`CaseForm` not found).

- [ ] **Step 13: Write the CaseForm component**

Create `frontend/src/components/CaseForm.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import type { TreatmentCase } from "@/lib/api-types";
import { treatmentCaseSchema, type TreatmentCaseInput } from "@/lib/treatment-case-schema";
import { caseListKey, createCase, updateCase } from "@/lib/staff-queries";

export function CaseForm({
  remedyId,
  healerId,
  treatmentCase,
}: {
  remedyId: number;
  healerId: number;
  treatmentCase?: TreatmentCase;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TreatmentCaseInput>({
    resolver: zodResolver(treatmentCaseSchema),
    defaultValues: {
      patientAge: treatmentCase?.patientAge ?? 0,
      patientSex: treatmentCase?.patientSex ?? "",
      symptoms: treatmentCase?.symptoms ?? "",
      result: treatmentCase?.result ?? "",
      note: treatmentCase?.note ?? "",
      treatedOn: treatmentCase?.treatedOn ?? "",
    },
  });

  const save = useMutation({
    mutationFn: (values: TreatmentCaseInput) =>
      treatmentCase
        ? updateCase(treatmentCase.id, values)
        : createCase({ ...values, remedyId, healerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseListKey(remedyId) });
      router.push(`/staff/remedies/${remedyId}/treatment-cases`);
      router.refresh();
    },
  });

  const field = "w-full rounded border border-stone-300 p-2";

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} className="max-w-lg space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="patientSex" className="text-sm font-medium">
          Patient sex (เพศ)
        </label>
        <input id="patientSex" className={field} {...register("patientSex")} />
        {errors.patientSex ? <p className="text-sm text-red-600">{errors.patientSex.message}</p> : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="patientAge" className="text-sm font-medium">
          Patient age (อายุ)
        </label>
        <input id="patientAge" type="number" min={0} className={field} {...register("patientAge")} />
        {errors.patientAge ? <p className="text-sm text-red-600">{errors.patientAge.message}</p> : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="treatedOn" className="text-sm font-medium">
          Date treated (วันที่รักษา)
        </label>
        <input id="treatedOn" type="date" className={field} {...register("treatedOn")} />
        {errors.treatedOn ? <p className="text-sm text-red-600">{errors.treatedOn.message}</p> : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="symptoms" className="text-sm font-medium">
          Symptoms (อาการ)
        </label>
        <textarea id="symptoms" rows={2} className={field} {...register("symptoms")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="result" className="text-sm font-medium">
          Result (ผลการรักษา)
        </label>
        <textarea id="result" rows={2} className={field} {...register("result")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="note" className="text-sm font-medium">
          Note (หมายเหตุ)
        </label>
        <textarea id="note" rows={2} className={field} {...register("note")} />
      </div>
      {save.isError ? <p className="text-sm text-red-600">Could not save. Try again.</p> : null}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded bg-stone-800 px-4 py-2 text-white disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => router.push(`/staff/remedies/${remedyId}/treatment-cases`)}
          className="rounded border border-stone-300 px-4 py-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 14: Run the test to verify it passes**

Run: `cd frontend && pnpm test src/components/CaseForm.test.tsx`
Expected: PASS.

- [ ] **Step 15: Write the case pages**

Create `frontend/src/app/staff/remedies/[remedyId]/treatment-cases/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { CaseAdminList } from "@/components/CaseAdminList";
import { getRemedy } from "@/lib/api";

export default async function StaffCasesPage({
  params,
}: {
  params: Promise<{ remedyId: string }>;
}) {
  const { remedyId } = await params;
  const id = Number(remedyId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const remedy = await getRemedy(id);
  if (!remedy) notFound();

  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">Treatment cases for {remedy.name}</h1>
      <CaseAdminList remedyId={id} />
    </section>
  );
}
```

Create `frontend/src/app/staff/remedies/[remedyId]/treatment-cases/new/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { CaseForm } from "@/components/CaseForm";
import { getRemedy } from "@/lib/api";

export default async function NewCasePage({
  params,
}: {
  params: Promise<{ remedyId: string }>;
}) {
  const { remedyId } = await params;
  const id = Number(remedyId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const remedy = await getRemedy(id);
  if (!remedy) notFound();

  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">New treatment case</h1>
      <CaseForm remedyId={id} healerId={remedy.healerId} />
    </section>
  );
}
```

Create `frontend/src/app/staff/remedies/[remedyId]/treatment-cases/[treatmentCaseId]/edit/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { CaseForm } from "@/components/CaseForm";
import { getRemedy, getTreatmentCase } from "@/lib/api";

export default async function EditCasePage({
  params,
}: {
  params: Promise<{ remedyId: string; treatmentCaseId: string }>;
}) {
  const { remedyId, treatmentCaseId } = await params;
  const rId = Number(remedyId);
  const cId = Number(treatmentCaseId);
  if (!Number.isInteger(rId) || rId <= 0 || !Number.isInteger(cId) || cId <= 0) notFound();

  const remedy = await getRemedy(rId);
  if (!remedy) notFound();
  const treatmentCase = await getTreatmentCase(cId);
  if (!treatmentCase) notFound();

  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">Edit treatment case</h1>
      <CaseForm remedyId={rId} healerId={remedy.healerId} treatmentCase={treatmentCase} />
    </section>
  );
}
```

- [ ] **Step 16: Verify tests, lint, build**

Run: `cd frontend && pnpm test && pnpm lint && pnpm build`
Expected: all case tests PASS (plus prior); lint clean; build succeeds (new /staff and /bff routes compile).

- [ ] **Step 17: Manual smoke (optional, needs API + Docker)**

```bash
# log in as staff → pick a district → a healer → Remedies → add a remedy → Cases → add a case (date picker)
```

- [ ] **Step 18: Commit** (orchestrator commits.)

---

## Self-Review

**Spec coverage (remedy + case admin):**
- Remedy CRUD under a healer, with the FK-409 delete surfaced (spec §7.2) — Task 1. ✓
- Treatment case CRUD under a remedy, patient age+sex+date, `treatedOn` as `YYYY-MM-DD` (spec §6.1, §7.2) — Task 2. ✓
- Reuses the auth/BFF/TanStack pattern; every write authenticated through `/bff/*`. ✓
- Navigation wired: healer list → Remedies; remedy list → Cases. ✓
- Deferred by design: photo upload UI (next plan), search. ✓

**Placeholder scan:** No TBD/TODO. Real code every step. Delete failures surfaced (no silent-fail repeat). Native `<input type="date">` for the date (platform feature over a picker lib). Age coerced from the numeric input.

**Type consistency:** `remedySchema`/`RemedyInput` match `remedyRequest` (name, symptoms, ingredients, preparationMethod, usage, note) + `healerId` on create only. `treatmentCaseSchema`/`TreatmentCaseInput` match `treatmentCaseRequest` (patientAge, patientSex, symptoms, result, note, treatedOn) + `remedyId`+`healerId` on create only. `remedyListKey(healerId)`/`caseListKey(remedyId)` are used identically by each list query and its mutations' `invalidateQueries`. `/bff/remedies` + `/bff/remedies/{id}` and `/bff/treatment-cases` + `/bff/treatment-cases/{id}` match the client fetchers. `getTreatmentCase` reuses `api.ts`'s `getOrNull`. `formatThaiDate`/`patientSexLabel` reused from Plan 5. `treatedOn` round-trips as `YYYY-MM-DD` (backend returns that; the date input consumes/produces it).

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-14-staff-admin-remedy-case.md`.
