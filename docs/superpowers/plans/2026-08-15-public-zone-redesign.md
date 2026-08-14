# Public Zone Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the public (non-staff) pages of the Next.js frontend into the "Modern Utility" visual system, province-neutral, with no change to the API, data model, or staff zone.

**Architecture:** View-layer only. Add semantic design tokens and a heading serif font to `globals.css`/`layout.tsx`, build a small set of restyled shared components, then rewire each public page to use them. Server components keep fetching through `@/lib/api`; only markup and classes change.

**Tech Stack:** Next.js App Router, React 19, Tailwind v4 (CSS `@theme`, tokens in `globals.css`), lucide-react (icons), Vitest + @testing-library/react (jsdom).

**Spec:** `docs/superpowers/specs/2026-08-15-public-zone-redesign-design.md`

## Global Constraints

- Restyle only. Do NOT change `@/lib/api`, `@/lib/api-types`, any API route, or the staff zone (`app/staff/**`).
- Use only fields that exist on the real types (`src/lib/api-types.ts`). Do not render data the model does not have. Known gaps vs. the preview, deferred to "Future work" — herb photo, herb family/taste/part-used/other-names, healer stat counts, a dedicated province page route.
- Every color comes from a token. No raw hex in a component. Both light and dark must read correctly.
- Keep Thai first, English second. Headings use the serif; body uses the existing sans.
- Brand, header, and footer name NO province. Province appears only as a tag/facet/breadcrumb.
- Follow the repo test pattern: component-level tests with `@testing-library/react`, run `npm test` (`vitest run`). Commit after each task.
- Run `npm run lint` before each commit; fix warnings you introduce.

**Run all commands from `frontend/`.**

---

### Task 1: Design tokens and heading font

**Files:**
- Modify: `frontend/src/app/globals.css` (add token block + `@theme inline` mappings)
- Modify: `frontend/src/app/layout.tsx:1-22` (add `Noto_Serif_Thai`, set font variables on `<body>`)

**Interfaces:**
- Produces (Tailwind utilities, via `@theme inline`): `bg-bg`, `bg-surface`, `bg-surface-2`, `text-ink`, `text-ink-soft`, `text-ink-faint`, `bg-brand`, `text-brand`, `text-brand-strong`, `bg-brand-tint`, `border-line`, `text-caution`, `bg-caution-tint`, and `font-serif` (heading) / `font-sans` (body) via CSS variables `--font-serif`, `--font-sans`.

- [ ] **Step 1: Add the token block to `globals.css`**

Add after the existing `.dark { … }` block (do not remove existing shadcn tokens):

```css
:root {
  --bg: #f6f8f6;
  --surface: #ffffff;
  --surface-2: #f1f5f1;
  --ink: #182019;
  --ink-soft: #586259;
  --ink-faint: #8a958b;
  --brand: #157a4b;
  --brand-strong: #0e5d39;
  --brand-tint: #eaf3ec;
  --line: #e3e8e3;
  --caution: #b7791f;
  --caution-tint: #f6efe0;
}
.dark {
  --bg: #0e1310;
  --surface: #161c18;
  --surface-2: #1b231d;
  --ink: #e7ece7;
  --ink-soft: #9aa89e;
  --ink-faint: #6c7a70;
  --brand: #45c583;
  --brand-strong: #69d59d;
  --brand-tint: #16241b;
  --line: #26302a;
  --caution: #e0ad5c;
  --caution-tint: #201a10;
}
```

Then extend the existing `@theme inline { … }` block with:

```css
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-ink: var(--ink);
  --color-ink-soft: var(--ink-soft);
  --color-ink-faint: var(--ink-faint);
  --color-brand: var(--brand);
  --color-brand-strong: var(--brand-strong);
  --color-brand-tint: var(--brand-tint);
  --color-line: var(--line);
  --color-caution: var(--caution);
  --color-caution-tint: var(--caution-tint);
  --font-serif: var(--font-noto-serif-thai);
```

- [ ] **Step 2: Load the serif font in `layout.tsx`**

Replace the font import/const and the `<body>`/`<html>` tags:

```tsx
import { Noto_Sans_Thai, Noto_Serif_Thai } from "next/font/google";

const notoThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-noto-sans-thai",
});
const notoSerifThai = Noto_Serif_Thai({
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-noto-serif-thai",
});
```

On `<body>`, add both variables and keep the base classes:

```tsx
<body className={`${notoThai.variable} ${notoSerifThai.variable} ${notoThai.className} bg-bg text-ink`}>
```

- [ ] **Step 3: Verify the app compiles and tokens resolve**

Run: `npm run lint`
Expected: no new errors.

Run: `npm test`
Expected: existing tests still PASS (no behavior change yet).

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat(frontend): add public-zone design tokens and heading serif font"
```

---

### Task 2: Province-neutral site header

Extract the header out of `layout.tsx` into a testable component with a province-neutral brand.

**Files:**
- Create: `frontend/src/components/SiteHeader.tsx`
- Create: `frontend/src/components/SiteHeader.test.tsx`
- Modify: `frontend/src/app/layout.tsx` (render `<SiteHeader />`, drop inline header markup)

**Interfaces:**
- Consumes: `SearchBox` from `@/components/SearchBox` (small variant added in Task 3; until then it renders the current SearchBox — acceptable, restyled next task).
- Produces: `SiteHeader` (no props).

- [ ] **Step 1: Write the failing test**

```tsx
// SiteHeader.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "./SiteHeader";

describe("SiteHeader", () => {
  it("shows a province-neutral brand and a staff link", () => {
    render(<SiteHeader />);
    const brand = screen.getByRole("link", { name: /ตำรายาพื้นบ้าน/ });
    expect(brand).toHaveAttribute("href", "/");
    expect(brand.textContent).not.toMatch(/ยโสธร/);
    expect(screen.getByRole("link", { name: /เจ้าหน้าที่/ })).toHaveAttribute("href", "/staff");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- SiteHeader`
Expected: FAIL (cannot find `./SiteHeader`).

- [ ] **Step 3: Write `SiteHeader.tsx`**

```tsx
import Link from "next/link";

import { SearchBox } from "@/components/SearchBox";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" className="whitespace-nowrap font-serif text-lg font-semibold text-ink">
          ตำรายา<span className="text-brand">พื้นบ้าน</span>
        </Link>
        <div className="hidden flex-1 sm:block">
          <SearchBox />
        </div>
        <Link
          href="/staff"
          prefetch={false}
          className="ml-auto whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-brand hover:text-brand"
        >
          สำหรับเจ้าหน้าที่
        </Link>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Wire it into `layout.tsx`**

Remove the inline `<header>…</header>` block. Import and render `<SiteHeader />` above `<main>`. Widen the main container to match: `className="mx-auto max-w-5xl px-4 py-8"`.

```tsx
import { SiteHeader } from "@/components/SiteHeader";
// …
<Providers>
  <SiteHeader />
  <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
</Providers>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- SiteHeader`
Expected: PASS.

Run: `npm run lint`
Expected: no new errors (remove the now-unused `SearchBox`/`Link` imports from `layout.tsx`).

- [ ] **Step 6: Commit**

```bash
git add src/components/SiteHeader.tsx src/components/SiteHeader.test.tsx src/app/layout.tsx
git commit -m "feat(frontend): province-neutral SiteHeader, extracted from layout"
```

---

### Task 3: Search + chip primitives

**Files:**
- Modify: `frontend/src/components/SearchBox.tsx` (add a `size` variant; restyle with tokens)
- Modify: `frontend/src/components/SearchBox.test.tsx` (keep existing assertions; add size test)
- Create: `frontend/src/components/Chip.tsx`
- Create: `frontend/src/components/Chip.test.tsx`

**Interfaces:**
- Produces: `SearchBox({ defaultValue?: string; size?: "sm" | "lg" })` (default `"lg"`).
- Produces: `Chip({ children: ReactNode; href?: string; active?: boolean })` — a pill; renders an `<a>` when `href` is set, else a `<span>`.

- [ ] **Step 1: Write the failing Chip test**

```tsx
// Chip.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Chip } from "./Chip";

describe("Chip", () => {
  it("renders a link chip when href is set", () => {
    render(<Chip href="/districts">ยโสธร</Chip>);
    expect(screen.getByRole("link", { name: "ยโสธร" })).toHaveAttribute("href", "/districts");
  });
  it("marks the active chip", () => {
    render(<Chip active>ทั้งหมด</Chip>);
    expect(screen.getByText("ทั้งหมด")).toHaveAttribute("aria-current", "true");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- Chip`
Expected: FAIL (cannot find `./Chip`).

- [ ] **Step 3: Write `Chip.tsx`**

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

export function Chip({
  children,
  href,
  active = false,
}: {
  children: ReactNode;
  href?: string;
  active?: boolean;
}) {
  const cls = active
    ? "bg-brand text-white"
    : "bg-brand-tint text-brand-strong hover:bg-brand hover:text-white";
  const shape = "inline-block rounded-full px-3.5 py-1.5 text-sm transition";
  if (href) {
    return (
      <Link href={href} className={`${shape} ${cls}`}>
        {children}
      </Link>
    );
  }
  return (
    <span className={`${shape} ${cls}`} aria-current={active ? "true" : undefined}>
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Restyle `SearchBox` with a size variant**

```tsx
export function SearchBox({
  defaultValue = "",
  size = "lg",
}: {
  defaultValue?: string;
  size?: "sm" | "lg";
}) {
  const pad = size === "lg" ? "px-4 py-3 text-base" : "px-3 py-2 text-sm";
  return (
    <form method="get" action="/search" className="flex gap-2">
      <input
        type="search"
        name="searchTerm"
        defaultValue={defaultValue}
        placeholder="ค้นหาอาการหรือสมุนไพร (search symptom or herb)"
        aria-label="Search symptom or herb"
        className={`w-full rounded-xl border border-line bg-surface text-ink ${pad}`}
      />
      <button
        type="submit"
        className="rounded-xl bg-brand px-5 font-semibold text-white"
      >
        ค้นหา
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Add the size assertion to `SearchBox.test.tsx`**

Keep the existing test. Add:

```tsx
it("keeps the input and button", () => {
  render(<SearchBox size="sm" />);
  expect(screen.getByRole("searchbox")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "ค้นหา" })).toBeInTheDocument();
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- SearchBox Chip`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/SearchBox.tsx src/components/SearchBox.test.tsx src/components/Chip.tsx src/components/Chip.test.tsx
git commit -m "feat(frontend): Chip primitive and SearchBox size variant"
```

---

### Task 4: RecordCard and LinkRow

**Files:**
- Modify: `frontend/src/components/RecordCard.tsx` (token restyle, optional `tag`, leaf icon fallback)
- Modify: `frontend/src/components/RecordCard.test.tsx` (add tag + icon assertions)
- Create: `frontend/src/components/LinkRow.tsx`
- Create: `frontend/src/components/LinkRow.test.tsx`

**Interfaces:**
- Produces: `RecordCard({ href; title; subtitle?; tag?; children? })`. Shows a leaf thumbnail, the title (serif), the italic subtitle, and an optional tag pill.
- Produces: `LinkRow({ href; title; subtitle?; meta?; icon? })` — one row: leading icon box, title + subtitle, right-aligned `meta`. `icon` defaults to a `℞` glyph.

- [ ] **Step 1: Write the failing RecordCard test**

```tsx
// add to RecordCard.test.tsx
it("shows a tag when given", () => {
  render(<RecordCard href="/herbs/1" title="ฟ้าทะลายโจร" subtitle="Andrographis" tag="แก้ไข้" />);
  expect(screen.getByText("แก้ไข้")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- RecordCard`
Expected: FAIL (`tag` not rendered).

- [ ] **Step 3: Rewrite `RecordCard.tsx`**

```tsx
import Link from "next/link";
import { Leaf } from "lucide-react";
import type { ReactNode } from "react";

export function RecordCard({
  href,
  title,
  subtitle,
  tag,
  children,
}: {
  href: string;
  title: string;
  subtitle?: string;
  tag?: string;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg"
    >
      <div className="grid aspect-[16/10] place-items-center bg-brand-tint text-brand">
        <Leaf className="h-8 w-8 opacity-80" aria-hidden />
      </div>
      <div className="p-4">
        <h3 className="font-serif text-lg font-semibold text-ink">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-sm italic text-ink-faint">{subtitle}</p> : null}
        {tag ? (
          <span className="mt-2 inline-block rounded-full bg-brand-tint px-2.5 py-0.5 text-xs text-brand-strong">
            {tag}
          </span>
        ) : null}
        {children ? <div className="mt-2 text-sm text-ink-soft">{children}</div> : null}
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Write the failing LinkRow test**

```tsx
// LinkRow.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LinkRow } from "./LinkRow";

describe("LinkRow", () => {
  it("renders a titled row link with meta", () => {
    render(<LinkRow href="/remedies/1" title="ยาต้มแก้ไข้" subtitle="ฟ้าทะลายโจร" meta="แก้ไข้" />);
    const link = screen.getByRole("link", { name: /ยาต้มแก้ไข้/ });
    expect(link).toHaveAttribute("href", "/remedies/1");
    expect(screen.getByText("แก้ไข้")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `npm test -- LinkRow`
Expected: FAIL (cannot find `./LinkRow`).

- [ ] **Step 6: Write `LinkRow.tsx`**

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

export function LinkRow({
  href,
  title,
  subtitle,
  meta,
  icon = "℞",
}: {
  href: string;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Link href={href} className="flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-surface-2">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-brand-tint font-serif text-brand-strong">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-serif font-semibold text-ink">{title}</span>
        {subtitle ? <span className="block truncate text-sm text-ink-soft">{subtitle}</span> : null}
      </span>
      {meta ? <span className="ml-auto whitespace-nowrap text-right text-sm text-ink-faint">{meta}</span> : null}
    </Link>
  );
}
```

Wrap groups of `LinkRow` in a container where used: `<div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">…</div>`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- RecordCard LinkRow`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/RecordCard.tsx src/components/RecordCard.test.tsx src/components/LinkRow.tsx src/components/LinkRow.test.tsx
git commit -m "feat(frontend): restyle RecordCard and add LinkRow"
```

---

### Task 5: Home page

**Files:**
- Create: `frontend/src/components/SectionHead.tsx` (small titled section header with optional "see all")
- Modify: `frontend/src/app/page.tsx`

**Interfaces:**
- Consumes: `RecordCard`, `LinkRow`, `Chip`, `SearchBox`, `EmptyState`, `SectionHead`; `listHerbs`, `listRecentRemedies`, `listRecentCases`, `listProvinces` from `@/lib/api`; `formatThaiDate` from `@/lib/format`.
- Produces: `SectionHead({ titleThai; titleEnglish?; href? })`.

- [ ] **Step 1: Write `SectionHead.tsx`** (no separate test — trivial; covered by page use)

```tsx
import Link from "next/link";

export function SectionHead({
  titleThai,
  titleEnglish,
  href,
}: {
  titleThai: string;
  titleEnglish?: string;
  href?: string;
}) {
  return (
    <div className="mb-4 mt-9 flex items-baseline gap-2.5">
      <h2 className="font-serif text-xl text-ink">{titleThai}</h2>
      {titleEnglish ? <span className="text-sm text-ink-faint">{titleEnglish}</span> : null}
      {href ? (
        <Link href={href} className="ml-auto text-sm font-semibold text-brand hover:text-brand-strong">
          ดูทั้งหมด →
        </Link>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `page.tsx`**

Fetch provinces alongside the existing data, and render the province-neutral home. Replace the whole component body:

```tsx
import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { LinkRow } from "@/components/LinkRow";
import { RecordCard } from "@/components/RecordCard";
import { SearchBox } from "@/components/SearchBox";
import { SectionHead } from "@/components/SectionHead";
import { formatThaiDate } from "@/lib/format";
import { listHerbs, listProvinces, listRecentCases, listRecentRemedies } from "@/lib/api";

export default async function HomePage() {
  const [herbs, remedies, cases, provinces] = await Promise.all([
    listHerbs(),
    listRecentRemedies(6),
    listRecentCases(6),
    listProvinces(),
  ]);

  return (
    <section>
      <div className="py-8 text-center">
        <h1 className="mb-1.5 font-serif text-3xl text-ink">ค้นหาสมุนไพรและตำรับยาพื้นบ้าน</h1>
        <p className="mb-5 text-ink-soft">Folk herbs, remedies, and healers — recorded from local wisdom</p>
        <div className="mx-auto max-w-xl">
          <SearchBox />
        </div>
      </div>

      <SectionHead titleThai="สมุนไพร" titleEnglish="Herbs" href="/herbs" />
      {herbs.length === 0 ? (
        <EmptyState message="No herbs yet." />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {herbs.slice(0, 4).map((h) => (
            <RecordCard key={h.id} href={`/herbs/${h.id}`} title={h.nameThai} subtitle={h.nameEnglish} />
          ))}
        </div>
      )}

      <SectionHead titleThai="ตำรับยา" titleEnglish="Remedies" href="/remedies" />
      {remedies.length === 0 ? (
        <EmptyState message="No remedies yet." />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {remedies.map((r) => (
            <LinkRow key={r.id} href={`/remedies/${r.id}`} title={r.name} subtitle={r.symptoms} />
          ))}
        </div>
      )}

      <SectionHead titleThai="เคสการรักษาล่าสุด" titleEnglish="Recent cases" />
      {cases.length === 0 ? (
        <EmptyState message="No cases yet." />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {cases.map((c) => (
            <LinkRow
              key={c.id}
              href={`/remedies/${c.remedyId}`}
              icon="✚"
              title={c.symptoms || "—"}
              subtitle={`รักษาด้วยตำรับ #${c.remedyId}`}
              meta={formatThaiDate(c.treatedOn)}
            />
          ))}
        </div>
      )}

      {provinces.length > 0 ? (
        <>
          <SectionHead titleThai="เลือกตามพื้นที่" titleEnglish="By area" href="/districts" />
          <div className="flex flex-wrap gap-2">
            {provinces.map((p) => (
              <Chip key={p.id} href="/districts">
                {p.nameThai}
              </Chip>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
```

Note: the "by area" chips link to the existing `/districts` list (no province-filtered route exists yet — see Future work). Cases show `symptoms` as the title because the case list gives no remedy name.

- [ ] **Step 3: Verify build and tests**

Run: `npm run lint`
Expected: no new errors.

Run: `npm test`
Expected: PASS (unchanged component tests).

Manual: `npm run dev`, open `/`. Confirm brand has no province, the "by area" row shows provinces as chips, and the page reads in both light and dark (toggle OS theme).

- [ ] **Step 4: Commit**

```bash
git add src/components/SectionHead.tsx src/app/page.tsx
git commit -m "feat(frontend): restyle home page, province-neutral by-area facet"
```

---

### Task 6: Detail primitives

Shared building blocks for herb / remedy / healer / district detail pages.

**Files:**
- Create: `frontend/src/components/DetailHeader.tsx`
- Create: `frontend/src/components/ContentBlock.tsx`
- Create: `frontend/src/components/Callout.tsx`
- Create: `frontend/src/components/FactPanel.tsx`
- Create: `frontend/src/components/DetailPrimitives.test.tsx`

**Interfaces:**
- Produces: `DetailHeader({ titleThai; subtitle?; editHref? })` — serif title, secondary line, optional edit link.
- Produces: `ContentBlock({ titleThai; titleEnglish?; children })` — a card with a titled block.
- Produces: `Callout({ children; variant?: "info" | "caution" })` — tinted box; `caution` uses caution tokens.
- Produces: `FactPanel({ title; facts: { key: string; value: ReactNode }[] })` — labelled fact list in a panel.

- [ ] **Step 1: Write the failing test**

```tsx
// DetailPrimitives.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Callout } from "./Callout";
import { ContentBlock } from "./ContentBlock";
import { DetailHeader } from "./DetailHeader";
import { FactPanel } from "./FactPanel";

describe("detail primitives", () => {
  it("DetailHeader shows title and optional edit link", () => {
    render(<DetailHeader titleThai="ฟ้าทะลายโจร" subtitle="Andrographis" editHref="/staff/herbs/1/edit" />);
    expect(screen.getByRole("heading", { name: "ฟ้าทะลายโจร" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /แก้ไข/ })).toHaveAttribute("href", "/staff/herbs/1/edit");
  });
  it("ContentBlock renders its title and body", () => {
    render(<ContentBlock titleThai="สรรพคุณ" titleEnglish="Properties">แก้ไข้</ContentBlock>);
    expect(screen.getByRole("heading", { name: /สรรพคุณ/ })).toBeInTheDocument();
    expect(screen.getByText("แก้ไข้")).toBeInTheDocument();
  });
  it("Callout renders children", () => {
    render(<Callout variant="caution">ข้อควรระวัง</Callout>);
    expect(screen.getByText("ข้อควรระวัง")).toBeInTheDocument();
  });
  it("FactPanel renders key/value facts", () => {
    render(<FactPanel title="ข้อมูล" facts={[{ key: "วงศ์", value: "Acanthaceae" }]} />);
    expect(screen.getByText("วงศ์")).toBeInTheDocument();
    expect(screen.getByText("Acanthaceae")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- DetailPrimitives`
Expected: FAIL (missing modules).

- [ ] **Step 3: Write the four components**

`DetailHeader.tsx`:

```tsx
import Link from "next/link";

export function DetailHeader({
  titleThai,
  subtitle,
  editHref,
}: {
  titleThai: string;
  subtitle?: string;
  editHref?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="font-serif text-3xl text-ink">{titleThai}</h1>
        {subtitle ? <p className="mt-1 font-serif italic text-ink-soft">{subtitle}</p> : null}
      </div>
      {editHref ? (
        <Link
          href={editHref}
          className="whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-brand hover:text-brand"
        >
          ✎ แก้ไข
        </Link>
      ) : null}
    </div>
  );
}
```

`ContentBlock.tsx`:

```tsx
import type { ReactNode } from "react";

export function ContentBlock({
  titleThai,
  titleEnglish,
  children,
}: {
  titleThai: string;
  titleEnglish?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-3.5 rounded-2xl border border-line bg-surface p-5">
      <h2 className="mb-1.5 flex items-baseline gap-2 font-serif text-lg text-brand-strong">
        {titleThai}
        {titleEnglish ? <span className="text-xs font-normal text-ink-faint">{titleEnglish}</span> : null}
      </h2>
      <div className="whitespace-pre-line text-ink">{children}</div>
    </section>
  );
}
```

`Callout.tsx`:

```tsx
import type { ReactNode } from "react";

export function Callout({
  children,
  variant = "info",
}: {
  children: ReactNode;
  variant?: "info" | "caution";
}) {
  const cls =
    variant === "caution"
      ? "border-caution/40 bg-caution-tint text-ink"
      : "border-brand/30 bg-brand-tint text-ink";
  return <div className={`mt-3.5 rounded-2xl border p-4 text-sm ${cls}`}>{children}</div>;
}
```

`FactPanel.tsx`:

```tsx
import type { ReactNode } from "react";

export function FactPanel({
  title,
  facts,
}: {
  title: string;
  facts: { key: string; value: ReactNode }[];
}) {
  const shown = facts.filter((f) => f.value !== "" && f.value != null);
  if (shown.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-ink-faint">
        {title}
      </div>
      <dl className="px-4 py-1.5">
        {shown.map((f) => (
          <div key={f.key} className="flex justify-between gap-3 border-b border-line py-2 text-sm last:border-0">
            <dt className="text-ink-soft">{f.key}</dt>
            <dd className="text-right font-medium text-ink">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- DetailPrimitives`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/DetailHeader.tsx src/components/ContentBlock.tsx src/components/Callout.tsx src/components/FactPanel.tsx src/components/DetailPrimitives.test.tsx
git commit -m "feat(frontend): detail primitives (header, block, callout, fact panel)"
```

---

### Task 7: Herb and Remedy detail pages

**Files:**
- Modify: `frontend/src/app/herbs/[herbId]/page.tsx`
- Modify: `frontend/src/app/herbs/page.tsx` (herb list — grid restyle)
- Modify: `frontend/src/app/remedies/[remedyId]/page.tsx`

**Interfaces:**
- Consumes: `DetailHeader`, `ContentBlock`, `Callout`, `FactPanel`, `LinkRow`, `RecordCard`, `Breadcrumb`, `EmptyState`; api `getHerb`, `listRemediesByHerb`, `listHerbs`, `getRemedy`.
- Herb real fields: `nameThai, nameEnglish, scientificName, properties, description`. Remedy real fields: `name, symptoms, herbs[] (RemedyHerb: herbId, nameThai, amount), preparationMethod, usage, note, healerId`.

- [ ] **Step 1: Rewrite the herb detail page**

Two-column layout: article + side panel. Use only real fields.

```tsx
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/Breadcrumb";
import { ContentBlock } from "@/components/ContentBlock";
import { DetailHeader } from "@/components/DetailHeader";
import { EmptyState } from "@/components/EmptyState";
import { FactPanel } from "@/components/FactPanel";
import { LinkRow } from "@/components/LinkRow";
import { getHerb, listRemediesByHerb } from "@/lib/api";

export default async function HerbPage({ params }: { params: Promise<{ herbId: string }> }) {
  const { herbId } = await params;
  const id = Number(herbId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const herb = await getHerb(id);
  if (!herb) notFound();
  const remedies = await listRemediesByHerb(id);

  return (
    <section>
      <Breadcrumb
        items={[
          { label: "หน้าแรก", href: "/" },
          { label: "สมุนไพร", href: "/herbs" },
          { label: herb.nameThai },
        ]}
      />
      <div className="grid items-start gap-8 md:grid-cols-[1fr_296px]">
        <div>
          <DetailHeader titleThai={herb.nameThai} subtitle={herb.nameEnglish} editHref={`/staff/herbs/${herb.id}/edit`} />
          {herb.properties ? (
            <ContentBlock titleThai="สรรพคุณ" titleEnglish="Properties">{herb.properties}</ContentBlock>
          ) : null}
          {herb.description ? (
            <ContentBlock titleThai="ลักษณะและรายละเอียด" titleEnglish="Description">{herb.description}</ContentBlock>
          ) : null}

          <h2 className="mb-3 mt-8 font-serif text-lg text-ink">ตำรับยาที่ใช้สมุนไพรนี้</h2>
          {remedies.length === 0 ? (
            <EmptyState message="No remedies use this herb yet." />
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {remedies.map((r) => (
                <LinkRow key={r.id} href={`/remedies/${r.id}`} title={r.name} subtitle={r.symptoms} />
              ))}
            </div>
          )}
        </div>
        <aside className="md:sticky md:top-24">
          <FactPanel
            title="ข้อมูลสมุนไพร · Quick facts"
            facts={[{ key: "ชื่อวิทยาศาสตร์", value: herb.scientificName }]}
          />
        </aside>
      </div>
    </section>
  );
}
```

Note: only `scientificName` is a real fact. Family / taste / part-used / other-names are NOT in the model — do not invent them (Future work).

- [ ] **Step 2: Restyle the herb list page**

In `herbs/page.tsx`, keep the fetch; change the grid and breadcrumb labels:

```tsx
<Breadcrumb items={[{ label: "หน้าแรก", href: "/" }, { label: "สมุนไพร" }]} />
<h1 className="mb-4 font-serif text-2xl text-ink">สมุนไพร <span className="text-base text-ink-faint">Herbs</span></h1>
{/* grid: */}
<div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
  {herbs.map((h) => (
    <RecordCard key={h.id} href={`/herbs/${h.id}`} title={h.nameThai} subtitle={h.nameEnglish} />
  ))}
</div>
```

- [ ] **Step 3: Rewrite the remedy detail page**

Use `herbs[]`, `preparationMethod`, `usage`, `note`. Read the current file first for the exact fetch calls, then restyle:

```tsx
<DetailHeader titleThai={remedy.name} editHref={`/staff/remedies/${remedy.id}/edit`} />
<ContentBlock titleThai="อาการ" titleEnglish="Symptoms">{remedy.symptoms}</ContentBlock>
<ContentBlock titleThai="ตัวยา" titleEnglish="Ingredients">
  <ul className="ml-4 list-disc">
    {remedy.herbs.map((h) => (
      <li key={h.herbId}>
        <a className="text-brand hover:underline" href={`/herbs/${h.herbId}`}>{h.nameThai}</a>
        {h.amount ? ` — ${h.amount}` : ""}
      </li>
    ))}
  </ul>
</ContentBlock>
{remedy.preparationMethod ? (
  <ContentBlock titleThai="วิธีปรุงและใช้" titleEnglish="Preparation">
    {[remedy.preparationMethod, remedy.usage].filter(Boolean).join("\n\n")}
  </ContentBlock>
) : null}
{remedy.note ? <Callout variant="caution"><b>หมายเหตุ:</b> {remedy.note}</Callout> : null}
```

Wrap it in the same two-column shell with a `FactPanel` side panel showing `{ key: "อาการ", value: remedy.symptoms }`. Keep the existing breadcrumb but use Thai labels (`หน้าแรก`, `ตำรับยา`).

- [ ] **Step 4: Verify**

Run: `npm run lint` then `npm test`
Expected: no new errors; tests PASS.

Manual: `npm run dev`, open a herb and a remedy detail page; confirm two-column layout, side panel, both themes.

- [ ] **Step 5: Commit**

```bash
git add src/app/herbs src/app/remedies
git commit -m "feat(frontend): restyle herb list, herb detail, and remedy detail"
```

---

### Task 8: Healer and District (location) pages

**Files:**
- Modify: `frontend/src/app/healers/[healerId]/page.tsx`
- Modify: `frontend/src/app/districts/[districtId]/page.tsx`
- Modify: `frontend/src/app/districts/page.tsx` (districts list)

**Interfaces:**
- Consumes: `DetailHeader`, `ContentBlock`, `LinkRow`, `RecordCard`, `Breadcrumb`, `SectionHead`, `FactPanel`; api `getHealer`, `listRemediesByHealer`, district/province getters.
- Healer real fields: `fullName, subDistrict, specialty, biography, districtId`. District real fields: `nameThai, nameEnglish, provinceId`.

- [ ] **Step 1: Rewrite the healer page**

```tsx
<Breadcrumb items={[{ label: "หน้าแรก", href: "/" }, { label: "หมอพื้นบ้าน" }, { label: healer.fullName }]} />
<div className="flex flex-wrap items-center gap-4">
  <span className="grid h-16 w-16 place-items-center rounded-full border border-brand bg-brand-tint font-serif text-2xl text-brand-strong">
    {healer.fullName.slice(0, 1)}
  </span>
  <div>
    <h1 className="font-serif text-2xl text-ink">{healer.fullName}</h1>
    <p className="text-ink-soft">{[healer.specialty, healer.subDistrict].filter(Boolean).join(" · ")}</p>
  </div>
</div>
{healer.biography ? <ContentBlock titleThai="ประวัติ" titleEnglish="Biography">{healer.biography}</ContentBlock> : null}
<SectionHead titleThai="ตำรับยาของหมอ" titleEnglish="Remedies" />
{/* LinkRow list of remedies from listRemediesByHealer, EmptyState if none */}
```

Show a real remedy count only if you already fetched the list: `subtitle={`${remedies.length} ตำรับ`}` on nothing invented. No fabricated "cases"/"years" tiles (not in the model).

- [ ] **Step 2: Rewrite the district page with province context**

Read the current file to see how it fetches the district and healers. Add the province for the breadcrumb/context. District detail shows the district; the breadcrumb carries `พื้นที่` and the province name:

```tsx
// after fetching `district`, fetch its province for the label:
const provinces = await listProvinces();
const province = provinces.find((p) => p.id === district.provinceId);
// …
<Breadcrumb
  items={[
    { label: "หน้าแรก", href: "/" },
    { label: "พื้นที่", href: "/districts" },
    ...(province ? [{ label: province.nameThai, href: "/districts" }] : []),
    { label: district.nameThai },
  ]}
/>
<DetailHeader titleThai={district.nameThai} subtitle={province ? `จังหวัด${province.nameThai}` : district.nameEnglish} />
<SectionHead titleThai="หมอพื้นบ้านในพื้นที่นี้" titleEnglish="Healers" />
{/* RecordCard/LinkRow list of healers in this district */}
```

Note: there is no province-only page route; the district page is the location page and shows its province as context. A dedicated province page is Future work.

- [ ] **Step 3: Restyle the districts list**

In `districts/page.tsx`, use Thai breadcrumb `พื้นที่` and a `RecordCard` grid of districts (title `nameThai`, subtitle `nameEnglish`).

- [ ] **Step 4: Verify**

Run: `npm run lint` then `npm test`
Expected: no new errors; tests PASS.

Manual: open a healer and a district page; confirm the district breadcrumb reads `หน้าแรก › พื้นที่ › <province> › <district>` and no stat tiles show invented data.

- [ ] **Step 5: Commit**

```bash
git add src/app/healers src/app/districts
git commit -m "feat(frontend): restyle healer and district pages with province context"
```

---

### Task 9: Search results, and final theme + a11y pass

**Files:**
- Modify: `frontend/src/app/search/page.tsx`
- Review: all pages touched above (no code unless a check fails)

**Interfaces:**
- Consumes: `search` from `@/lib/api` returning `SearchResponse { remedies, healers, herbs }`; `Chip`, `LinkRow`, `SearchBox`.

- [ ] **Step 1: Restyle the search page**

Read the current `search/page.tsx` for how it reads `searchTerm` and calls `search()`. Keep that logic. Restyle results into one list with type chips:

```tsx
<div className="flex flex-wrap items-center gap-3">
  <h1 className="font-serif text-xl text-ink">ผลการค้นหา “<span className="text-brand">{term}</span>”</h1>
  <span className="text-sm text-ink-faint">
    พบ {res.herbs.length + res.remedies.length + res.healers.length} รายการ
  </span>
</div>
<div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
  {res.herbs.map((h) => (
    <LinkRow key={`h${h.id}`} href={`/herbs/${h.id}`} icon="🌿" title={h.nameThai} subtitle={`สมุนไพร · ${h.scientificName}`} meta="สมุนไพร" />
  ))}
  {res.remedies.map((r) => (
    <LinkRow key={`r${r.id}`} href={`/remedies/${r.id}`} title={r.name} subtitle={`ตำรับยา · ${r.symptoms}`} meta="ตำรับยา" />
  ))}
  {res.healers.map((h) => (
    <LinkRow key={`he${h.id}`} href={`/healers/${h.id}`} icon="✚" title={h.fullName} subtitle={`หมอพื้นบ้าน · ${h.specialty}`} meta="หมอ" />
  ))}
</div>
```

Keep the existing empty-state behavior for an empty term or zero results.

- [ ] **Step 2: Final theme + accessibility check** (no code unless a check fails)

Run: `npm run dev`. For `/`, `/search?searchTerm=ไข้`, `/herbs`, a herb, a remedy, a healer, a district:
- Toggle OS light/dark. Every page must stay readable — no dark text on dark ground. If a page fails, the cause is a raw color; replace it with a token.
- Tab through each page. Every link, button, and input must show a visible focus ring.
- Shrink to 360px wide. No sideways scroll; grids collapse to one/two columns.

- [ ] **Step 3: Verify**

Run: `npm run lint` then `npm test`
Expected: no new errors; all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/search
git commit -m "feat(frontend): restyle search results and finalize theme/a11y pass"
```

---

## Self-review notes (coverage vs. spec)

- Spec §5 tokens/type → Task 1. §6 components → Tasks 2–6. §7 page layouts → Tasks 5, 7, 8, 9. §8 responsive + §9 a11y → Task 9 checks (plus per-component classes). §10 province-neutral → Tasks 2, 5, 8. §11 out-of-scope respected: no province page route, no map band, no photos, no invented herb/healer facts.
- **Deliberate deviations from the preview (data-driven):** herb side panel shows only `scientificName`; healer page shows no stat tiles; the "location" page is the existing district page with province context, not a standalone province page; "by area" chips link to `/districts`. All are recorded as Future work below.

## Future work (needs backend/route changes — out of this plan)

- A province page route (`/provinces/[id]`) and a province-filtered district/healer list, so "by area" can drill province → district properly.
- Herb photo and a richer herb fact set (family, taste, part used, other names) — needs new fields + API.
- Healer/district stat counts (remedies, cases) — needs count fields or endpoints.
- A province switcher/filter in the top nav.
- Real district/province maps.
