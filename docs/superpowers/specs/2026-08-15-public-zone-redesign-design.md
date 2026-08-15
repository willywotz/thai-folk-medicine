# Public Zone Redesign — Design Spec

Date: 2026-08-15
Status: Approved (brainstorming)
Preview: https://claude.ai/code/artifact/fda8c118-958f-4b5b-82e8-300903933240

## 1. Purpose

This spec changes the look of the public zone. It does not change the data model,
the API, or the backend. It restyles the pages that the public sees.

The public zone is every page that a visitor reads without a login:
home, search results, herb, remedy, healer, and location (province / district).
The staff zone (`/staff/**`) stays as it is. This spec does not touch it.

The goal is one clear visual system for all public pages. The system is a modern,
search-first web app. It is fast to scan, works well on a phone, and keeps the
Thai and English text side by side.

## 2. Decisions (from brainstorming)

1. **Direction:** "Modern Utility". A search-first app. Big search, filter chips,
   clean cards and rows. Findability comes before long reading. Two other
   directions ("Herbarium field guide" and "Living archive") were shown and not
   chosen.
2. **Province-neutral:** the app must hold more than one province later. The
   province is a facet of the data. It is not the identity of the app.
   - The brand does not name a province. It reads **ตำรายาพื้นบ้าน**.
   - The home page shows a light "by area" chip row of provinces. It is not a
     large district grid.
   - The location page shows one province, then its districts below it
     (province → district).
   - A case or a healer shows its province as a small location tag, not as a title.
3. **Preview only:** this task writes the spec. It writes no application code. The
   preview is an HTML mock. It is not part of the app.
4. **Bilingual:** every page keeps Thai first and English second. Thai text uses a
   serif for headings and a sans for body.

## 3. Scope

In scope (restyle only):

| Page | Route (unchanged) |
| --- | --- |
| Home | `/` |
| Search results | `/search` |
| Herb detail | `/herbs/[herbId]` |
| Herb list | `/herbs` |
| Remedy detail | `/remedies/[remedyId]` |
| Healer profile | `/healers/[healerId]` |
| Location (province → district) | `/districts/[districtId]` and list |
| Shared header / layout | `app/layout.tsx` |

Out of scope: the staff zone, the API, the domain model, and the database.

## 4. Architecture rule

Keep every project rule. This is a view-layer change only.

- Clean Architecture stays. The change touches only the Next.js view components.
- No API route changes. No new endpoint. Full English route names stay.
- 15-Factor and event-driven rules are not affected (no write path changes).
- The design adds no new runtime dependency. It uses Tailwind and the fonts that
  the app already loads.

## 5. Visual language (design tokens)

Define these as CSS variables in `globals.css`. Give a full light set and a full
dark set. The app already has a `.dark` pattern; keep it.

### 5.1 Color — light

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#f6f8f6` | page background |
| `--card` | `#ffffff` | card / panel surface |
| `--card-2` | `#f1f5f1` | row hover, soft fill |
| `--ink` | `#182019` | main text |
| `--soft` | `#586259` | secondary text |
| `--faint` | `#8a958b` | captions, meta |
| `--grn` | `#157a4b` | primary accent (search, links, active) |
| `--grn-d` | `#0e5d39` | accent text on light fill |
| `--grn-t` | `#eaf3ec` | accent tint (chips, icons) |
| `--line` | `#e3e8e3` | borders |
| `--amber` | `#b7791f` | caution only (not a second accent) |

### 5.2 Color — dark

| Token | Value |
| --- | --- |
| `--bg` | `#0e1310` |
| `--card` | `#161c18` |
| `--card-2` | `#1b231d` |
| `--ink` | `#e7ece7` |
| `--soft` | `#9aa89e` |
| `--faint` | `#6c7a70` |
| `--grn` | `#45c583` |
| `--grn-d` | `#69d59d` |
| `--grn-t` | `#16241b` |
| `--line` | `#26302a` |
| `--amber` | `#e0ad5c` |

Rule: green is the only accent. Amber marks a caution block only. Every color comes
from a token. No page sets a raw color that works in one theme only.

### 5.3 Type

- Headings: **Noto Serif Thai**, with a Latin serif fallback (Noto Serif, Georgia).
- Body and UI: **Sarabun**, with a system sans fallback.
- The app already loads a Thai font in `layout.tsx`. Add the serif for headings.
- Thai text needs room for vowel and tone marks. Keep body line-height near 1.7.
- Give headings `text-wrap: balance`.

### 5.4 Shape and space

- Card radius: 14px. Chip radius: full (pill). Small control radius: 8px.
- Card border: 1px `--line`. Card hover: lift 3px and show a soft shadow.
- Section gap: about 34px above a section head.
- Keep body text near 65 characters wide in reading blocks.

### 5.5 Icons

- Herb: a small leaf, drawn as inline SVG. Do not use an emoji for a herb.
- Remedy: the `℞` glyph. Case: the `✚` glyph.
- Do not use emoji as section markers.

## 6. Components

Reuse the app components and restyle them. Do not add a component that has one use.

| Component | Role | Notes |
| --- | --- | --- |
| Header / nav | brand, mini-search, staff link | brand is province-neutral |
| `SearchBox` | search input + button | large form on home, small form in nav |
| Filter chips | facet row | used on home, search, and location pages |
| `RecordCard` | herb / place card | photo (or leaf), Thai name, Latin name, tag |
| Row list | remedy / case / result rows | icon, title, subtitle, right-side tags or date |
| Detail head | title + Latin name + edit link | shared by herb, remedy, healer |
| Content block | a titled text block | Thai title + small English label |
| Callout | highlight or caution | caution uses amber |
| Side panel | quick facts + chip group | app panel, not a Wikipedia infobox |
| Stat tiles | count tiles | healer and location pages |
| Breadcrumb | path with province level | e.g. หน้าแรก › พื้นที่ › ยโสธร |

## 7. Page layouts

### 7.1 Home (`/`)
1. Search hero: title, one line of subtext, a large search form.
2. Filter chips: ทั้งหมด · สมุนไพร · ตำรับยา · หมอพื้นบ้าน · พื้นที่.
3. Herbs: a card grid (4 columns on desktop).
4. Remedies: a row list.
5. Recent cases: a row list with a date and a province tag.
6. By area: a light chip row of provinces (demoted). A "see all →" link goes to
   the location list.
7. Footer: a province-neutral line and a staff sign-in link.

### 7.2 Search results (`/search`)
- A result bar with the query and a count.
- Facet chips by type (herb / remedy / case), each with a count.
- One mixed row list. Each row shows a type tag.

### 7.3 Herb detail (`/herbs/[herbId]`)
- Detail head: Thai name, Latin name, edit link.
- A cover area for the photo.
- Blocks: สรรพคุณ (Properties), ลักษณะและรายละเอียด (Description).
- A "วิธีใช้" (how to use) callout.
- A remedy row list ("remedies that use this herb").
- Side panel: quick facts (scientific name, family, taste, part used) and an
  "other names" chip group.

### 7.4 Remedy detail (`/remedies/[remedyId]`)
- Detail head: name, healer line.
- Blocks: ตัวยา (Ingredients, a list), วิธีปรุงและใช้ (Preparation).
- A caution callout in amber.
- Side panel: recipe facts (symptom, form, healer link, area) and a herb link list.

### 7.5 Healer profile (`/healers/[healerId]`)
- Profile head: avatar, name, location line (district + province).
- Stat tiles: remedies, cases, years.
- A short text block.
- A remedy row list.

### 7.6 Location (`/districts/[districtId]` and list)
- This page shows a province. Title: จังหวัด<name>.
- A map band (placeholder for now).
- Stat tiles: districts, healers, remedies.
- Districts: a chip row inside the province.
- Healers in the province: a card list.
- Breadcrumb: หน้าแรก › พื้นที่ › <province>.

Note: the route id stays `districtId` for now. The page reads as a province page.
A later plan may split province and district routes. That is out of scope here.

## 8. Responsive

- Desktop: max width about 1080px, centered.
- Card grid: 4 columns, then 2 columns under about 820px, then 1 or 2 on a phone.
- Detail pages: two columns (content + side panel), then one column under 820px.
  The side panel moves below the content.
- The nav mini-search hides on a small screen. The home hero search stays.
- The page body never scrolls sideways. Wide content scrolls inside its own box.

## 9. Accessibility

- Every control shows a visible keyboard focus ring (green, 2px).
- Text and background keep a readable contrast in both themes.
- The search input and each icon button have a label.
- Motion is small. Respect `prefers-reduced-motion`.
- Color is not the only signal. A caution also has the word "ข้อควรระวัง".

## 10. Multi-province rules

These rules keep the app ready for more than one province:

1. The shell (brand, nav, footer) never names a province.
2. The province is data, shown as a tag or a facet, never as the page identity.
3. Location browse starts at the province level, then drills to districts.
4. A future province switcher or province filter belongs in the top nav. This spec
   leaves space for it but does not build it.

## 11. Out of scope / future

- No staff-zone restyle.
- No new API route and no province switcher control (future work).
- The map band is a placeholder. Real maps are future work.
- Real photos are future work. The design leaves photo slots ready.

## 12. Verification (when built later)

- Every public page uses only tokens for color. Check both themes.
- No page names a province in the header, brand, or footer.
- The location page shows province → district.
- Keyboard focus is visible on every link, button, and input.
- The layout does not scroll sideways on a 360px-wide screen.
