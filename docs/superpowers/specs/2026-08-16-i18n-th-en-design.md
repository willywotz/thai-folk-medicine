# Design — Frontend i18n (Thai + English, default Thai)

Date: 2026-08-16
Status: Approved (design), pending implementation plan
Scope: `frontend/` only. Backend and DB unchanged.

## Goal

Add two-language support to the Next.js frontend using the **official Next.js
App Router sub-path i18n standard** (per the bundled docs
`node_modules/next/dist/docs/01-app/02-guides/internationalization.md` and
`.../04-functions/next-root-params.md`). No i18n library.

- Locales: `th` (default) and `en`.
- URL carries the locale as the first path segment: `/th/herbs`, `/en/herbs`.
- A locale-less URL (`/herbs`) is redirected to the default locale (`/th/herbs`).
- **Translate UI chrome only** — fixed interface text (nav, buttons, section
  headings, form labels, empty states, breadcrumbs, validation messages).
  User-entered record content is shown exactly as saved. The database stores
  most record text in Thai only (herbs carry both `nameThai` and `nameEnglish`,
  but remedies, cases, and symptoms are Thai-only), so translating content would
  produce an uneven, half-translated result. Chrome-only is honest and complete.
- **Both zones** (public + staff) get translated dictionaries now.

Non-goals: translating record content; RTL; per-locale number/date libraries
(existing `formatThaiDate` stays; an `en` date variant is a dictionary/format
concern handled in the plan, not new infra); SEO hreflang tags (future).

## Standard being followed (from the bundled docs)

1. Nest all UI routes under a dynamic `app/[lang]` segment; `lang` becomes a
   **root parameter** readable anywhere server-side via `next/root-params`.
2. A `proxy` (this modified Next 16 names middleware "proxy") redirects
   locale-less requests to `/<defaultLocale><path>`.
3. Per-locale dictionaries loaded server-side; `hasLocale()` narrows the type
   and triggers `notFound()` for unknown locales.
4. `generateStaticParams` in the `[lang]` layout enumerates the locales.

## Architecture

### Route tree changes

Everything that renders UI moves under a new `[lang]` segment. The API route
handlers (`app/bff/*`) stay at the app root: a **static** segment (`bff`) wins
over the **dynamic** `[lang]` segment during route matching, and route handlers
cannot use `next/root-params` anyway (they have no locale need).

```
app/
├─ globals.css           # stays at app root; imported by [lang]/layout.tsx
├─ [lang]/
│  ├─ layout.tsx         # THE root layout (renders <html>/<body>). Moved from
│  │                     #   app/layout.tsx: fonts, globals import,
│  │                     #   <html lang={await lang()}>, SiteHeader, Providers,
│  │                     #   I18nProvider (client) fed locale + dict.
│  │                     #   Exports generateStaticParams() → [{lang:'th'},{lang:'en'}].
│  ├─ providers.tsx      # moved (TanStack Query provider) — unchanged content
│  ├─ not-found.tsx      # moved
│  ├─ page.tsx           # home (moved)
│  ├─ herbs/  remedies/  healers/  districts/  search/  treatment-cases/   # moved
│  ├─ login/             # moved
│  └─ staff/             # moved (all admin routes)
└─ bff/                  # UNCHANGED — API route handlers, no locale, no layout
```

There must be exactly one root layout, and it renders `<html>`/`<body>`. Next
allows the root layout to live at `app/[lang]/layout.tsx` (the docs' "Static
Rendering" example does exactly this). We therefore make `app/[lang]/layout.tsx`
the root layout and keep **no** `app/layout.tsx`. `bff` route handlers need no
layout, so a single root layout under `[lang]` is sufficient.

### i18n core — `src/lib/i18n/`

- `config.ts`
  ```ts
  export const locales = ["th", "en"] as const;
  export type Locale = (typeof locales)[number];
  export const defaultLocale: Locale = "th";
  export const hasLocale = (v: string): v is Locale =>
    (locales as readonly string[]).includes(v);
  ```
- `dictionaries/th.ts` — the **source of truth** for keys. A plain nested,
  strongly-typed object. `export type Dictionary = typeof th;`
- `dictionaries/en.ts` — `const en: Dictionary = { ... }`. Because it is typed as
  `Dictionary`, a missing or misspelled key is a **compile error** — no runtime
  completeness test needed.
- `getDictionary.ts` (server-only)
  ```ts
  import { lang } from "next/root-params";
  import { notFound } from "next/navigation";
  const dictionaries = {
    th: () => import("./dictionaries/th").then((m) => m.th),
    en: () => import("./dictionaries/en").then((m) => m.en),
  };
  export async function getDictionary() {
    const locale = await lang();
    if (!hasLocale(locale)) notFound();
    return dictionaries[locale]();
  }
  export async function getLocale(): Promise<Locale> { /* lang() + fallback */ }
  ```

Key namespacing (grouped by area): `common`, `nav`, `home`, `herb`, `remedy`,
`healer`, `district`, `case`, `search`, `auth`, `staff` (with sub-groups per
staff section). Exact keys enumerated during extraction in the plan.

### Server vs client access

- **Server components** (all public pages, most staff pages): call
  `const t = await getDictionary()` and read `t.home.recentCases`. No prop
  drilling — `lang()` resolves from the root param.
- **Client components** (staff forms built on react-hook-form; the language
  switcher): `next/root-params` cannot run client-side. So `[lang]/layout.tsx`
  passes `locale` and the resolved `dict` into a client `I18nProvider`
  (`src/components/I18nProvider.tsx`) via React context; client components read
  it with a `useT()` hook (`src/lib/i18n/useT.ts`). One provider at the root,
  no drilling.

### `proxy.ts` — merge locale redirect with the existing auth guard

The current `proxy.ts` guards `/staff/*` (needs `session` cookie) and `/login`.
After i18n those paths are locale-prefixed (`/th/staff`, `/en/login`). New logic,
in order:

1. Ignore `_next`, static assets, and `/bff` (matcher excludes them).
2. If the pathname's first segment is **not** a known locale → redirect to
   `/<defaultLocale><pathname>` (307).
3. Strip the locale prefix to get the "logical" path, then apply the **existing**
   auth rules against it:
   - logical `/login` + session → redirect to `/<locale>/staff`.
   - logical `/login` without session → allow.
   - logical `/staff/*` without session → redirect to `/<locale>/login`.
   - otherwise allow.
   Redirect targets preserve the current locale prefix.
4. Matcher widens from `["/staff/:path*","/login"]` to run on all UI paths so it
   can perform the locale redirect: `["/((?!_next|bff|.*\\..*).*)"]` (final
   pattern tuned in the plan; must still exclude API and files).

### Language switcher

`src/components/LanguageSwitcher.tsx` (client): reads `usePathname()`, replaces
the leading `/th`↔`/en` segment (adds one if somehow absent), renders a `<Link>`
pill (`TH | EN`). Placed in `SiteHeader`. On the staff shell header too (plan
decides placement). Uses `useT()` only for its `aria-label`.

## Data flow

```
request /herbs
  → proxy: no locale prefix → 307 /th/herbs
request /th/herbs
  → proxy: locale ok, not guarded → allow
  → [lang]/layout: lang()="th"; dict=await getDictionary(); <html lang="th">;
      <I18nProvider locale dict><SiteHeader/>{children}</I18nProvider>
  → page (server): const t = await getDictionary(); render t.* + record content as-is
  → client bits: useT() → same dict from context
```

## Error handling

- Unknown locale segment (`/fr/...`): `hasLocale` false → `getDictionary()` calls
  `notFound()` → the localized `not-found.tsx`.
- Missing dictionary key: impossible at runtime — caught by TypeScript at build.
- proxy must never redirect-loop: it only adds a prefix when the first segment is
  not a known locale, so a prefixed path is never re-prefixed.

## Testing (TDD, red first)

1. `src/proxy.test.ts` — extend the existing suite:
   - `/herbs` → 307 `/th/herbs` (locale redirect).
   - `/en/herbs` → allowed (no redirect).
   - `/th/staff/healers` without session → 307 `/th/login` (auth under locale).
   - `/en/staff` with session → allowed.
   - `/en/login` with session → 307 `/en/staff` (locale preserved).
   - `/bff/herbs` → not matched / allowed (no locale redirect).
2. `src/lib/i18n/getDictionary.test.ts` (or equivalent) — `hasLocale` true/false;
   unknown locale path triggers the `notFound` branch (mock `next/root-params`).
3. `src/components/LanguageSwitcher.test.tsx` — path-swap logic: `/th/herbs/x` →
   target `/en/herbs/x`, and vice versa; root `/th` → `/en`.
4. `en` dictionary completeness — enforced by the `Dictionary` type (compile
   time); no runtime test.

## Implementation phasing (for the plan)

Each phase leaves the app runnable and green.

- **Phase A — infrastructure + routing move (no visible copy change).**
  Create `lib/i18n/*` with `th`/`en` seeded from *current* literals for shared
  chrome only as needed to compile; move all UI routes under `[lang]`; add the
  root `[lang]/layout.tsx` with `generateStaticParams`; add `I18nProvider` +
  `useT`; merge `proxy.ts` (tests red→green); add `LanguageSwitcher`. After A,
  `/th/*` and `/en/*` both resolve; text is still all-Thai (English dict may
  echo Thai as placeholders where not yet translated) — but switching works.
- **Phase B — public-zone strings.** Extract every public-page Thai literal into
  `th`/`en`, wire pages to `t.*`. Verify home, herb, remedy, healer, district,
  search, treatment-cases in both locales.
- **Phase C — staff-zone strings.** Same for login + all staff pages, including
  client forms via `useT()`. Verify.

## Files touched (summary)

- New: `src/lib/i18n/{config,getDictionary,useT}.ts`,
  `src/lib/i18n/dictionaries/{th,en}.ts`, `src/components/I18nProvider.tsx`,
  `src/components/LanguageSwitcher.tsx`.
- Moved: everything under `src/app/` except `bff/` and `globals.css` → under
  `src/app/[lang]/`.
- Edited: `src/proxy.ts` (+ test), `SiteHeader.tsx`, and — during B/C — every
  file currently holding a Thai literal (~66 files).
- Unchanged: `src/app/bff/*`, backend, DB.

## Risks / notes

- This modified Next 16: middleware file is `proxy.ts`; verified `next/root-params`
  and sub-path routing exist in the bundled docs. Any surprise from the moved
  root layout is caught by `next dev`/`next build` in each phase.
- `bff` staying at root relies on static-over-dynamic segment precedence — assert
  with a proxy test that `/bff/*` is untouched, and smoke-test one BFF call.
- 66-file extraction is mechanical but large; phasing B/C keeps each PR reviewable.
