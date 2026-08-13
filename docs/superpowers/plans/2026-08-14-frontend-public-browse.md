# Frontend — Public Browse (Next.js) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public, server-rendered Next.js site that lets anyone browse the folk-medicine records of Yasothon by district → healer → remedy → treatment cases, with photos. Read-only; no login. (Staff admin UI is a separate later plan.)

**Architecture:** Next.js App Router (TypeScript). Public pages are React Server Components that fetch the Go API server-side through a small typed API client. Tailwind CSS for styling (no component library yet). A `next.config` rewrite proxies `/api/*` to the Go backend so the browser and server share one origin. Vitest + React Testing Library for the API client, formatters, and presentational components.

**Tech Stack:** Node 24, pnpm, Next.js (App Router) + TypeScript, Tailwind CSS, Vitest + @testing-library/react + jsdom. (shadcn/ui, TanStack Query, react-hook-form, zod are intentionally deferred to the staff-admin plan.)

**Spec:** `docs/superpowers/specs/2026-08-13-thai-folk-medicine-design.md` (§7.1 public read routes, §13.2 frontend stack). Backend contract: `CONTEXT.md` (running API on `:8080`).

## Global Constraints

- **Node 24+, pnpm.** The app lives in `frontend/`.
- **API contract (read):** the Go API serves, under `/api/v1`:
  - `GET /provinces` → `[{id, nameThai, nameEnglish}]`
  - `GET /provinces/{provinceId}/districts` → `[{id, provinceId, nameThai, nameEnglish}]`
  - `GET /districts/{districtId}/healers` → `[{id, districtId, fullName, subDistrict, specialty, biography, createdAt, updatedAt}]`
  - `GET /healers/{healerId}` → one healer object
  - `GET /healers/{healerId}/remedies` → `[{id, healerId, name, symptoms, ingredients, preparationMethod, usage, note, createdAt, updatedAt}]`
  - `GET /remedies/{remedyId}` → one remedy
  - `GET /remedies/{remedyId}/treatment-cases` → `[{id, remedyId, healerId, patientAge, patientSex, symptoms, result, note, treatedOn, createdAt, updatedAt}]`
  - `GET /treatment-cases/{treatmentCaseId}` → one case
  - `GET /photos/{photoId}` → the image bytes (there is no "list photos" endpoint yet — see the ceiling note below)
- **Server-side fetch base:** server components read the Go API at `process.env.INTERNAL_API_URL` (default `http://localhost:8080`). Browser requests to `/api/*` are proxied via `next.config` rewrite to the same target.
- **`withinlazy` — photos:** the API has no "list photos for owner" endpoint yet. Plan 5 renders a photo ONLY when a `photoId` is known; a gallery-by-owner needs a new backend endpoint (`GET /healers/{id}/photos` etc.) — note it, do not build it here. So the public pages show text records fully and are photo-ready via `GET /api/v1/photos/{photoId}`, but do not enumerate photos. `withinlazy: no list-photos-by-owner endpoint; add GET /{owner}/{id}/photos in a later backend plan.`
- **Language:** the content is Thai; keep Thai text first-class (UTF-8, a Thai-friendly font stack). UI chrome labels may be English.
- **Accessibility basics:** semantic HTML, alt text on images, real `<a>` navigation, headings in order.
- **TDD (adapted for React):** pure logic (API client, formatters) → Vitest unit tests, red→green. Presentational components → React Testing Library. Server-component pages get a light render/smoke check, not full E2E (Playwright is a later plan).
- **Commits:** Conventional Commits, one per task. **Branch:** `feat/frontend`. No secrets in the repo.

---

### Task 1: Scaffold Next.js app, proxy, and test setup

**Files:**
- Create: `frontend/` (via `create-next-app`) — `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/globals.css`, Tailwind config, ESLint config
- Create: `frontend/.env.example`
- Create: `frontend/vitest.config.ts`, `frontend/vitest.setup.ts`
- Create: `frontend/src/lib/format.ts`
- Test: `frontend/src/lib/format.test.ts`

**Interfaces:**
- Produces: a building Next.js app in `frontend/` with `pnpm build`, `pnpm dev`, `pnpm test`, `pnpm lint` scripts.
- Produces: `next.config.ts` rewrite `/api/:path*` → `${INTERNAL_API_URL}/api/:path*`.
- Produces: `format.ts` exporting `formatThaiDate(iso: string): string` and `patientSexLabel(sex: string): string` (small pure helpers used by later tasks).

- [ ] **Step 1: Scaffold the app non-interactively**

Run from the repo root:

```bash
pnpm create next-app@latest frontend --ts --app --tailwind --eslint --src-dir --use-pnpm --no-import-alias --no-turbopack --disable-git
```

(If a flag is rejected by the installed create-next-app version, drop only that flag and keep the rest; the required outcome is: App Router, TypeScript, Tailwind, ESLint, `src/` dir, pnpm, no separate git repo.)

- [ ] **Step 2: Add the API proxy and Thai-friendly base**

Replace `frontend/next.config.ts` (or `.mjs`) with:

```ts
import type { NextConfig } from "next";

const target = process.env.INTERNAL_API_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
```

Create `frontend/.env.example`:

```bash
# Where the Go API is reachable from the Next.js server (server components + proxy).
INTERNAL_API_URL=http://localhost:8080
```

- [ ] **Step 3: Install and configure Vitest + RTL**

```bash
cd frontend
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Create `frontend/vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

Create `frontend/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Add a `test` script to `frontend/package.json` scripts: `"test": "vitest run"`, and `"test:watch": "vitest"`.

- [ ] **Step 4: Write the failing formatter test**

Create `frontend/src/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { formatThaiDate, patientSexLabel } from "./format";

describe("formatThaiDate", () => {
  it("formats an ISO date to a readable day", () => {
    expect(formatThaiDate("2026-03-01")).toBe("1 March 2026");
  });

  it("returns an em dash for an empty value", () => {
    expect(formatThaiDate("")).toBe("—");
  });
});

describe("patientSexLabel", () => {
  it("maps known values", () => {
    expect(patientSexLabel("female")).toBe("Female");
    expect(patientSexLabel("male")).toBe("Male");
  });

  it("passes through an unknown value", () => {
    expect(patientSexLabel("other")).toBe("other");
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd frontend && pnpm test`
Expected: FAIL (cannot resolve `./format`).

- [ ] **Step 6: Write the formatters**

Create `frontend/src/lib/format.ts`:

```ts
/** Formats an ISO date (YYYY-MM-DD or RFC3339) as "D Month YYYY". */
export function formatThaiDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Turns a stored patient-sex value into a display label. */
export function patientSexLabel(sex: string): string {
  if (sex === "female") return "Female";
  if (sex === "male") return "Male";
  return sex;
}
```

- [ ] **Step 7: Verify build, lint, and tests**

Run: `cd frontend && pnpm test && pnpm lint && pnpm build`
Expected: tests PASS; lint clean; production build succeeds.

- [ ] **Step 8: Commit** (orchestrator commits.)

---

### Task 2: API types and typed server client

**Files:**
- Create: `frontend/src/lib/api-types.ts`
- Create: `frontend/src/lib/api.ts`
- Test: `frontend/src/lib/api.test.ts`

**Interfaces:**
- Produces: TypeScript types `Province`, `District`, `Healer`, `Remedy`, `TreatmentCase`, `Photo` mirroring the API JSON.
- Produces functions (all server-side; each throws `ApiError` on non-OK, returns `null` on 404 where noted):
  - `listDistricts(provinceId: number): Promise<District[]>`
  - `getFirstProvince(): Promise<Province | null>` (the site is single-province; picks the first)
  - `listHealersByDistrict(districtId: number): Promise<Healer[]>`
  - `getHealer(id: number): Promise<Healer | null>`
  - `listRemediesByHealer(healerId: number): Promise<Remedy[]>`
  - `getRemedy(id: number): Promise<Remedy | null>`
  - `listCasesByRemedy(remedyId: number): Promise<TreatmentCase[]>`
  - `photoUrl(photoId: number): string` (returns `/api/v1/photos/{id}` for use in `<img src>`)

- [ ] **Step 1: Write the API types**

Create `frontend/src/lib/api-types.ts`:

```ts
export interface Province {
  id: number;
  nameThai: string;
  nameEnglish: string;
}

export interface District {
  id: number;
  provinceId: number;
  nameThai: string;
  nameEnglish: string;
}

export interface Healer {
  id: number;
  districtId: number;
  fullName: string;
  subDistrict: string;
  specialty: string;
  biography: string;
  createdAt: string;
  updatedAt: string;
}

export interface Remedy {
  id: number;
  healerId: number;
  name: string;
  symptoms: string;
  ingredients: string;
  preparationMethod: string;
  usage: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface TreatmentCase {
  id: number;
  remedyId: number;
  healerId: number;
  patientAge: number;
  patientSex: string;
  symptoms: string;
  result: string;
  note: string;
  treatedOn: string;
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  id: number;
  ownerType: string;
  ownerId: number;
  caption: string;
}
```

- [ ] **Step 2: Write the failing API-client test**

Create `frontend/src/lib/api.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getHealer,
  getRemedy,
  listCasesByRemedy,
  listDistricts,
  listHealersByDistrict,
  photoUrl,
} from "./api";

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })) as unknown as typeof fetch,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("listDistricts", () => {
  it("returns the parsed list", async () => {
    mockFetchOnce(200, [{ id: 1, provinceId: 1, nameThai: "กุดชุม", nameEnglish: "Kut Chum" }]);
    const got = await listDistricts(1);
    expect(got).toHaveLength(1);
    expect(got[0].nameEnglish).toBe("Kut Chum");
  });
});

describe("getHealer", () => {
  it("returns null on 404", async () => {
    mockFetchOnce(404, { error: "healer not found" });
    expect(await getHealer(999)).toBeNull();
  });

  it("throws on 500", async () => {
    mockFetchOnce(500, { error: "boom" });
    await expect(getHealer(1)).rejects.toThrow();
  });
});

describe("getRemedy", () => {
  it("returns the remedy", async () => {
    mockFetchOnce(200, { id: 5, healerId: 2, name: "ยาต้ม" });
    const got = await getRemedy(5);
    expect(got?.name).toBe("ยาต้ม");
  });
});

describe("listHealersByDistrict / listCasesByRemedy", () => {
  it("parse lists", async () => {
    mockFetchOnce(200, [{ id: 1, districtId: 2, fullName: "หมอ ก" }]);
    expect(await listHealersByDistrict(2)).toHaveLength(1);

    mockFetchOnce(200, [{ id: 1, remedyId: 3, patientAge: 40 }]);
    expect(await listCasesByRemedy(3)).toHaveLength(1);
  });
});

describe("photoUrl", () => {
  it("builds the proxy path", () => {
    expect(photoUrl(7)).toBe("/api/v1/photos/7");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && pnpm test src/lib/api.test.ts`
Expected: FAIL (cannot resolve `./api`).

- [ ] **Step 4: Write the API client**

Create `frontend/src/lib/api.ts`:

```ts
import type {
  District,
  Healer,
  Province,
  Remedy,
  TreatmentCase,
} from "./api-types";

const base = process.env.INTERNAL_API_URL ?? "http://localhost:8080";
const apiRoot = `${base}/api/v1`;

/** ApiError carries the HTTP status of a failed API call. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiRoot}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new ApiError(`GET ${path} failed`, res.status);
  }
  return (await res.json()) as T;
}

/** getOrNull returns null on a 404, and rethrows every other error. */
async function getOrNull<T>(path: string): Promise<T | null> {
  try {
    return await getJson<T>(path);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function listProvinces(): Promise<Province[]> {
  return getJson<Province[]>("/provinces");
}

export async function getFirstProvince(): Promise<Province | null> {
  const provinces = await listProvinces();
  return provinces[0] ?? null;
}

export async function listDistricts(provinceId: number): Promise<District[]> {
  return getJson<District[]>(`/provinces/${provinceId}/districts`);
}

export async function listHealersByDistrict(districtId: number): Promise<Healer[]> {
  return getJson<Healer[]>(`/districts/${districtId}/healers`);
}

export async function getHealer(id: number): Promise<Healer | null> {
  return getOrNull<Healer>(`/healers/${id}`);
}

export async function listRemediesByHealer(healerId: number): Promise<Remedy[]> {
  return getJson<Remedy[]>(`/healers/${healerId}/remedies`);
}

export async function getRemedy(id: number): Promise<Remedy | null> {
  return getOrNull<Remedy>(`/remedies/${id}`);
}

export async function listCasesByRemedy(remedyId: number): Promise<TreatmentCase[]> {
  return getJson<TreatmentCase[]>(`/remedies/${remedyId}/treatment-cases`);
}

/** photoUrl returns a same-origin path so the browser fetches through the proxy. */
export function photoUrl(photoId: number): string {
  return `/api/v1/photos/${photoId}`;
}
```

- [ ] **Step 5: Verify tests + lint**

Run: `cd frontend && pnpm test && pnpm lint`
Expected: PASS + clean.

- [ ] **Step 6: Commit** (orchestrator commits.)

---

### Task 3: Public pages — home, district, healer

**Files:**
- Create: `frontend/src/components/RecordCard.tsx`
- Create: `frontend/src/components/Breadcrumb.tsx`
- Create: `frontend/src/components/EmptyState.tsx`
- Test: `frontend/src/components/RecordCard.test.tsx`
- Test: `frontend/src/components/Breadcrumb.test.tsx`
- Modify: `frontend/src/app/layout.tsx` (Thai font + shell)
- Create: `frontend/src/app/page.tsx` (home: districts)
- Create: `frontend/src/app/districts/[districtId]/page.tsx` (healers)
- Create: `frontend/src/app/healers/[healerId]/page.tsx` (healer + remedies)

**Interfaces:**
- Produces: `RecordCard({ href, title, subtitle?, children? })` — a linked card.
- Produces: `Breadcrumb({ items: { label: string; href?: string }[] })`.
- Produces: `EmptyState({ message })`.
- Consumes: the API client from Task 2; `formatThaiDate` from Task 1.

- [ ] **Step 1: Write the failing component tests**

Create `frontend/src/components/RecordCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecordCard } from "./RecordCard";

describe("RecordCard", () => {
  it("renders a titled link", () => {
    render(<RecordCard href="/healers/1" title="หมอสมชาย" subtitle="สมุนไพร" />);
    const link = screen.getByRole("link", { name: /หมอสมชาย/ });
    expect(link).toHaveAttribute("href", "/healers/1");
    expect(screen.getByText("สมุนไพร")).toBeInTheDocument();
  });
});
```

Create `frontend/src/components/Breadcrumb.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Breadcrumb } from "./Breadcrumb";

describe("Breadcrumb", () => {
  it("links every item except the last", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Kut Chum", href: "/districts/1" },
          { label: "หมอสมชาย" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Kut Chum" })).toHaveAttribute("href", "/districts/1");
    expect(screen.queryByRole("link", { name: "หมอสมชาย" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && pnpm test src/components`
Expected: FAIL (components not found).

- [ ] **Step 3: Write the presentational components**

Create `frontend/src/components/RecordCard.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

export function RecordCard({
  href,
  title,
  subtitle,
  children,
}: {
  href: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition hover:border-stone-400 hover:shadow"
    >
      <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-stone-500">{subtitle}</p> : null}
      {children ? <div className="mt-2 text-sm text-stone-700">{children}</div> : null}
    </Link>
  );
}
```

Create `frontend/src/components/Breadcrumb.tsx`:

```tsx
import Link from "next/link";

export function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-stone-500">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {item.href ? (
              <Link href={item.href} className="hover:text-stone-800 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className="text-stone-800">{item.label}</span>
            )}
            {i < items.length - 1 ? <span aria-hidden>/</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

Create `frontend/src/components/EmptyState.tsx`:

```tsx
export function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-stone-500">
      {message}
    </p>
  );
}
```

- [ ] **Step 4: Run the component tests to verify they pass**

Run: `cd frontend && pnpm test src/components`
Expected: PASS.

- [ ] **Step 5: Set the app shell + Thai font**

Replace `frontend/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const notoThai = Noto_Sans_Thai({ subsets: ["thai", "latin"], display: "swap" });

export const metadata: Metadata = {
  title: "ตำรายาหมอพื้นบ้านยโสธร",
  description: "Folk-medicine records of local healers in Yasothon province.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body className={`${notoThai.className} bg-stone-100 text-stone-900`}>
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <a href="/" className="text-xl font-bold text-stone-900">
              ตำรายาหมอพื้นบ้าน ยโสธร
            </a>
            <p className="text-sm text-stone-500">
              Folk-medicine knowledge of Yasothon, by district
            </p>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
```

Note: `next/font/google` fetches the font at build time (network needed once). If the sandbox blocks it during `pnpm build`, replace the font import with a Tailwind font-family stack in `globals.css` and drop `notoThai.className` — note the substitution in the report.

- [ ] **Step 6: Write the home page (districts of Yasothon)**

Create `frontend/src/app/page.tsx`:

```tsx
import { RecordCard } from "@/components/RecordCard";
import { EmptyState } from "@/components/EmptyState";
import { getFirstProvince, listDistricts } from "@/lib/api";

export default async function HomePage() {
  const province = await getFirstProvince();
  if (!province) {
    return <EmptyState message="No province data yet." />;
  }
  const districts = await listDistricts(province.id);

  return (
    <section>
      <h1 className="mb-1 text-2xl font-bold">{province.nameThai}</h1>
      <p className="mb-6 text-stone-500">Choose a district (อำเภอ) to see its healers.</p>
      {districts.length === 0 ? (
        <EmptyState message="No districts yet." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {districts.map((d) => (
            <RecordCard
              key={d.id}
              href={`/districts/${d.id}`}
              title={d.nameThai}
              subtitle={d.nameEnglish}
            />
          ))}
        </div>
      )}
    </section>
  );
}
```

Note: the scaffold uses `@/` for `src/` only if `--no-import-alias` was NOT applied. If `@/` is not configured, use relative imports (`../components/RecordCard`) throughout, or add the alias to `tsconfig.json` (`"paths": { "@/*": ["./src/*"] }`). Pick one and be consistent; note which in the report.

- [ ] **Step 7: Write the district page (healers)**

Create `frontend/src/app/districts/[districtId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
import { listHealersByDistrict } from "@/lib/api";

export default async function DistrictPage({
  params,
}: {
  params: Promise<{ districtId: string }>;
}) {
  const { districtId } = await params;
  const id = Number(districtId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const healers = await listHealersByDistrict(id);

  return (
    <section>
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "District" }]} />
      <h1 className="mb-6 text-2xl font-bold">Healers (หมอพื้นบ้าน)</h1>
      {healers.length === 0 ? (
        <EmptyState message="No healers recorded in this district yet." />
      ) : (
        <div className="grid gap-3">
          {healers.map((h) => (
            <RecordCard
              key={h.id}
              href={`/healers/${h.id}`}
              title={h.fullName}
              subtitle={[h.specialty, h.subDistrict].filter(Boolean).join(" · ")}
            />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 8: Write the healer page (detail + remedies)**

Create `frontend/src/app/healers/[healerId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { RecordCard } from "@/components/RecordCard";
import { getHealer, listRemediesByHealer } from "@/lib/api";

export default async function HealerPage({
  params,
}: {
  params: Promise<{ healerId: string }>;
}) {
  const { healerId } = await params;
  const id = Number(healerId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const healer = await getHealer(id);
  if (!healer) notFound();

  const remedies = await listRemediesByHealer(id);

  return (
    <section>
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "District", href: `/districts/${healer.districtId}` },
          { label: healer.fullName },
        ]}
      />
      <h1 className="text-2xl font-bold">{healer.fullName}</h1>
      {healer.specialty ? (
        <p className="mt-1 text-stone-600">ความชำนาญ: {healer.specialty}</p>
      ) : null}
      {healer.biography ? (
        <p className="mt-4 whitespace-pre-line text-stone-700">{healer.biography}</p>
      ) : null}

      <h2 className="mb-3 mt-8 text-xl font-semibold">Remedies (ตำรับยา)</h2>
      {remedies.length === 0 ? (
        <EmptyState message="No remedies recorded for this healer yet." />
      ) : (
        <div className="grid gap-3">
          {remedies.map((r) => (
            <RecordCard key={r.id} href={`/remedies/${r.id}`} title={r.name} subtitle={r.symptoms} />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 9: Verify tests, lint, and build**

Run: `cd frontend && pnpm test && pnpm lint && pnpm build`
Expected: component tests PASS; lint clean; build succeeds (pages compile as server components).

- [ ] **Step 10: Commit** (orchestrator commits.)

---

### Task 4: Remedy detail page + photo display + polish

**Files:**
- Create: `frontend/src/components/DefinitionList.tsx`
- Test: `frontend/src/components/DefinitionList.test.tsx`
- Create: `frontend/src/components/PhotoImage.tsx`
- Test: `frontend/src/components/PhotoImage.test.tsx`
- Create: `frontend/src/app/remedies/[remedyId]/page.tsx` (remedy + cases)
- Create: `frontend/src/app/not-found.tsx`
- Modify: `frontend/next.config.ts` (allow the API host for `next/image`, OR use a plain `<img>` — see step)

**Interfaces:**
- Produces: `DefinitionList({ items: { term: string; value: string }[] })` — skips empty values.
- Produces: `PhotoImage({ photoId, alt })` — renders `<img src={photoUrl(photoId)} alt={alt}>`.
- Consumes: `getRemedy`, `listCasesByRemedy`, `formatThaiDate`, `patientSexLabel`, `photoUrl`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/DefinitionList.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DefinitionList } from "./DefinitionList";

describe("DefinitionList", () => {
  it("shows non-empty terms and hides empty ones", () => {
    render(
      <DefinitionList
        items={[
          { term: "สรรพคุณ", value: "แก้ไข้" },
          { term: "หมายเหตุ", value: "" },
        ]}
      />,
    );
    expect(screen.getByText("สรรพคุณ")).toBeInTheDocument();
    expect(screen.getByText("แก้ไข้")).toBeInTheDocument();
    expect(screen.queryByText("หมายเหตุ")).toBeNull();
  });
});
```

Create `frontend/src/components/PhotoImage.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PhotoImage } from "./PhotoImage";

describe("PhotoImage", () => {
  it("points at the proxied photo path with alt text", () => {
    render(<PhotoImage photoId={7} alt="ต้นสมุนไพร" />);
    const img = screen.getByAltText("ต้นสมุนไพร");
    expect(img).toHaveAttribute("src", "/api/v1/photos/7");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && pnpm test src/components/DefinitionList.test.tsx src/components/PhotoImage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write the components**

Create `frontend/src/components/DefinitionList.tsx`:

```tsx
export function DefinitionList({
  items,
}: {
  items: { term: string; value: string }[];
}) {
  const shown = items.filter((i) => i.value.trim() !== "");
  if (shown.length === 0) return null;
  return (
    <dl className="grid gap-3 sm:grid-cols-[10rem_1fr]">
      {shown.map((i) => (
        <div key={i.term} className="sm:contents">
          <dt className="font-semibold text-stone-600">{i.term}</dt>
          <dd className="whitespace-pre-line text-stone-800">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
```

Create `frontend/src/components/PhotoImage.tsx`:

```tsx
import { photoUrl } from "@/lib/api";

export function PhotoImage({ photoId, alt }: { photoId: number; alt: string }) {
  // A plain <img> (not next/image) keeps the API host config-free and streams
  // straight through the /api proxy.
  return (
    <img
      src={photoUrl(photoId)}
      alt={alt}
      className="max-h-96 w-auto rounded-lg border border-stone-200"
    />
  );
}
```

Note: if ESLint's `@next/next/no-img-element` rule fails the build, add an eslint-disable comment on the `<img>` line with a short reason (the image is served by our own API proxy and needs no `next/image` optimization), or disable that rule in the ESLint config. Note the choice in the report.

- [ ] **Step 4: Run the component tests to verify they pass**

Run: `cd frontend && pnpm test src/components/DefinitionList.test.tsx src/components/PhotoImage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the remedy detail page (remedy + treatment cases)**

Create `frontend/src/app/remedies/[remedyId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/Breadcrumb";
import { DefinitionList } from "@/components/DefinitionList";
import { EmptyState } from "@/components/EmptyState";
import { formatThaiDate, patientSexLabel } from "@/lib/format";
import { getRemedy, listCasesByRemedy } from "@/lib/api";

export default async function RemedyPage({
  params,
}: {
  params: Promise<{ remedyId: string }>;
}) {
  const { remedyId } = await params;
  const id = Number(remedyId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const remedy = await getRemedy(id);
  if (!remedy) notFound();

  const cases = await listCasesByRemedy(id);

  return (
    <section>
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Healer", href: `/healers/${remedy.healerId}` },
          { label: remedy.name },
        ]}
      />
      <h1 className="mb-4 text-2xl font-bold">{remedy.name}</h1>
      <DefinitionList
        items={[
          { term: "สรรพคุณ", value: remedy.symptoms },
          { term: "ตัวยา", value: remedy.ingredients },
          { term: "วิธีปรุง", value: remedy.preparationMethod },
          { term: "วิธีใช้", value: remedy.usage },
          { term: "หมายเหตุ", value: remedy.note },
        ]}
      />

      <h2 className="mb-3 mt-8 text-xl font-semibold">Treatment cases (เคสการรักษา)</h2>
      {cases.length === 0 ? (
        <EmptyState message="No treatment cases recorded for this remedy yet." />
      ) : (
        <ul className="grid gap-3">
          {cases.map((c) => (
            <li key={c.id} className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="text-sm text-stone-500">
                {formatThaiDate(c.treatedOn)} · {patientSexLabel(c.patientSex)}, age {c.patientAge}
              </p>
              <DefinitionList
                items={[
                  { term: "อาการ", value: c.symptoms },
                  { term: "ผลการรักษา", value: c.result },
                  { term: "หมายเหตุ", value: c.note },
                ]}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Write the not-found page**

Create `frontend/src/app/not-found.tsx`:

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <section className="text-center">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="mt-2 text-stone-600">This record does not exist.</p>
      <Link href="/" className="mt-4 inline-block text-stone-800 underline">
        Back to districts
      </Link>
    </section>
  );
}
```

- [ ] **Step 7: Verify the whole app**

Run: `cd frontend && pnpm test && pnpm lint && pnpm build`
Expected: all component tests PASS; lint clean; production build succeeds.

- [ ] **Step 8: Manual smoke (optional, needs the API + Docker)**

```bash
# terminal 1: backend
cd backend && docker compose up -d && go run ./cmd/api
# terminal 2: frontend
cd frontend && INTERNAL_API_URL=http://localhost:8080 pnpm dev
# open http://localhost:3000 → Yasothon districts → a district → a healer → a remedy → its cases
```

- [ ] **Step 9: Commit** (orchestrator commits.)

---

## Self-Review

**Spec coverage (public browse slice):**
- Next.js App Router + TS + Tailwind (spec §13.2) — Task 1. ✓
- Server-side data from the Go API + `/api` proxy — Tasks 1–2. ✓
- Public browse by district → healer → remedy → cases (spec §7.1, browse-first) — Tasks 3–4. ✓
- Photos rendered via `GET /api/v1/photos/{id}` — Task 4. ✓
- Deferred by design: staff login + CRUD forms + photo upload (needs TanStack Query, react-hook-form, zod, shadcn) → next plan; search → later; photo-gallery-by-owner needs a new backend endpoint (noted `withinlazy`). ✓

**Placeholder scan:** No TBD/TODO. Real code every step. Concrete not-found handling (`notFound()` on bad/missing ids). Fallback notes for two environment risks (Google font fetch; import alias) with explicit substitutions.

**Type consistency:** `api-types.ts` fields match the backend DTO JSON exactly (camelCase: `nameThai`, `fullName`, `preparationMethod`, `treatedOn`, `patientSex`, …). The API client functions' names/return types are used identically in the pages. `photoUrl(id)` returns `/api/v1/photos/{id}` (proxy path) and is used by both `PhotoImage` and any `<img>`. `formatThaiDate`/`patientSexLabel` (Task 1) are consumed in Task 4.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-14-frontend-public-browse.md`.
