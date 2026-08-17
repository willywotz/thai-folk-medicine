# Drop the Node Frontend — BFF→Go + Vite SPA — Design

Date: 2026-08-17
Status: Design for review. **A de-risking spike is recommended before the full plan** (see Risks).

## Goal

Remove the Node.js process from production to save RAM. Rewrite the frontend as a
**Vite + React Router single-page app** served as static files by nginx, move the
BFF proxy and cookie/session auth into the Go backend, and let the browser call
`/api` directly (nginx proxies it to Go).

## Decisions (from the design conversation)

- **Rewrite the frontend to a Vite + React Router SPA.** Chosen over Next.js
  static export — see "Framework decision" below.
- Everything renders **client-side (CSR)**. Mitigate perceived performance with
  **route-based code splitting** (`React.lazy`) and **skeleton screens**.
- **SEO / SSR first-paint is knowingly given up.** The public site becomes a JS
  app. If discoverability later matters, the upgrade path is a prerender step
  (SSG/`vite-ssg` or a crawler-prerender); out of scope here.
- Reuse React Query (already a dependency) for all data fetching.
- Keep the CI/CD image-based release flow: the frontend image becomes an nginx
  image serving the Vite `dist/`.

## Framework decision: Vite SPA over Next static export

Both drop Node at runtime. The difference is dynamic routes:

- **Next `output: "export"`** cannot serve `/remedies/:id` without enumerating
  every id at build (`generateStaticParams`) — that is SSG: content frozen at
  build, 404 on new records, rebuild-on-publish. Avoiding it forces ugly
  query-param URLs (`/remedy?id=123`) for **9** dynamic routes, including a nested
  double-dynamic one.
- **Vite SPA** serves one `index.html` for any path (`try_files … /index.html`);
  React Router reads `/remedies/:id` client-side and fetches. **Clean URLs, any
  id, no per-id build files, no rebuild-on-publish.** This is what an SPA is for.

Cost: a Next-agnostic frontend rewrite (routing shell + Next-import swaps). The
component library and business logic largely survive (see scope).

## Current state (what Node does today, and where it goes)

| Node does today | Moves to |
| --- | --- |
| 17 BFF route handlers (`app/bff/*`), cookie→`Authorization: Bearer` | **Go** reads the JWT from the `session` cookie; browser calls `/api` directly |
| Login stores JWT via `setSession` (httpOnly cookie) | **Go** login endpoint sets the httpOnly cookie (`Set-Cookie`) |
| `proxy.ts` middleware: locale redirect | React Router (default-locale route) or nginx `/` → `/th` |
| `proxy.ts` middleware: `/staff/*` guard | **client-side** guard (SPA probes `/api/v1/session`) |
| `/api/:path*` rewrite (baked at build) | **nginx** `location /api { proxy_pass backend }` |
| SSR of pages | **client fetch** via React Query |

The Go backend already does Bearer-JWT auth (`bffForward` sends
`Authorization: Bearer <jwt>`), so the auth model does not change — only *where*
the JWT is read (cookie instead of a header the BFF added).

## Target architecture

```
browser ──HTTPS──> edge/host nginx (:80, TLS in front)
                      │
                      └─> frontend container (nginx:alpine, :14285)
                            ├─ /api/*    proxy_pass http://backend:8080  (Go reads session cookie)
                            ├─ /assets/* serve Vite hashed static assets
                            └─ /*        try_files $uri /index.html      (SPA fallback)
```

No Node at runtime. The frontend container is nginx serving the Vite `dist/` and
proxying `/api` to the `backend` service. Postgres and the Go backend are
otherwise unchanged.

## Component changes

### Go backend

1. **Cookie auth middleware:** accept the JWT from the `session` cookie **and**
   (transition window) the `Authorization: Bearer` header. Same validation/claims.
2. **Login** (`POST /api/v1/auth/login`): respond with
   `Set-Cookie: session=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`
   instead of returning the JWT.
3. **Logout** (`POST /api/v1/auth/logout`): clear the cookie.
4. **Session probe** (`GET /api/v1/session`): return the current staff identity
   (200) or 401 — the SPA calls this to gate staff routes (httpOnly cookie is
   invisible to JS).
5. No CORS needed — same origin via nginx.

### nginx (frontend container config)

- `location /api/ { proxy_pass http://backend:8080; proxy_set_header Cookie $http_cookie; }`
- `location / { try_files $uri /index.html; }` — SPA fallback; any deep link
  boots the app and React Router resolves it.
- Long-cache `/assets/*` (hashed filenames); `index.html` no-cache.

### Frontend — rewrite to Vite + React Router SPA

- **Scaffold:** Vite + React + TypeScript; keep Tailwind v4, `@base-ui/react`,
  shadcn components, `react-hook-form`, `zod`, `@tanstack/react-query`.
- **Routing:** a React Router route tree built from the current 33 `page.tsx`
  files. Dynamic segments become real params (`/:lang/remedies/:remedyId`).
  Nested layouts (public shell, staff shell) become layout routes.
- **Next-import swaps (mechanical):**
  - `next/link` (19 files) → `react-router` `<Link>`.
  - `next/navigation` (27 files) → `useNavigate`/`useParams`/`useSearchParams`/
    `useLocation` from `react-router`.
  - `next/image` — **none** (already plain `<img>`).
  - `next/headers` (1 file, `session.ts`) — **deleted**; auth is cookie+Go now.
  - Server actions — **none**.
- **i18n:** keep the `dictionaries/{th,en}.ts` and the `Dictionary` type. Replace
  `next/root-params` server lookup with a small client i18n: `/:lang` route param
  → provider → `useT()` (the client hook already exists). Default-locale redirect
  via an index route (`/` → `/th`).
- **Data layer:** a typed `apiFetch` hitting `/api/v1/*` (cookie sent
  automatically) + React Query hooks; `isLoading` → skeleton screens.
- **Code splitting:** `React.lazy` per route section.
- **Staff auth:** a `StaffGuard` route that calls `GET /api/v1/session`
  (skeleton while pending, redirect to `/login` on 401). Login form POSTs to
  `/api/v1/auth/login`; logout POSTs to `/api/v1/auth/logout`.
- **Delete** the whole `app/bff/*` tree, `bff-forward.ts`, `proxy.ts`, and the
  Next `app/` router scaffolding.

### Frontend Docker image

- Builder: `pnpm build` → `dist/` (Vite).
- Production: `nginx:alpine`, `COPY dist /usr/share/nginx/html` + the nginx config
  above. No Node, no `server.js`. Runtime RAM ≈ a few MB.

### Deploy

- `compose.prod.yaml.j2`: the `frontend` service runs the new nginx image on
  `:14285`. `INTERNAL_API_URL` is dropped (the container nginx has the backend
  target). The host nginx (`/etc/nginx/conf.d/`) is unchanged.

## What we lose (accepted) and how we soften it

- **SEO + social preview meta** — initial HTML is an app shell. Accepted;
  skeletons + code splitting address perceived speed, not crawlability.
- **SSR first paint** — replaced by skeletons while React Query fetches.
- Regained vs the Next-export alternative: **clean `/remedies/:id` URLs** and **no
  rebuild-on-publish**.

## Security

- Cookie stays `HttpOnly; Secure; SameSite=Lax`. `SameSite=Lax` blocks the cookie
  on cross-site state-changing POSTs — covers most CSRF for a JSON API. Add a
  double-submit CSRF token only if needed.
- The client guard is UX only; real enforcement is Go rejecting invalid/absent
  JWTs on every `/api` call.

## Risks

1. **Rewrite scope.** This replaces the Next runtime, not just config. ~46 files
   import `next/*` (19 `next/link` + 27 `next/navigation`, overlapping), 33 `page.tsx`
   + 2 `layout.tsx` become route/layout components. Mitigant: the **81 `components/`
   and 33 `lib/` files are framework-agnostic** (base-ui, shadcn, Tailwind, zod,
   dictionaries) and mostly port unchanged; 29 files are already `"use client"`.
2. **i18n port.** `next/root-params`-based `getDictionary` (server) must become a
   client `/:lang` provider. The dictionaries and `useT()` survive; the wiring is
   new. Spike this first — it touches the root layout and every page.
3. **httpOnly cookie invisible to JS.** The guard must probe `GET /api/v1/session`;
   expect a brief skeleton-then-redirect flash on protected routes. Confirm
   acceptable.
4. **base-ui / shadcn portability.** These are React + Tailwind, framework-neutral,
   but confirm no component secretly imports `next/*` beyond the counts above.

## Spike (recommended, ~½ day, throwaway branch)

Prove the load-bearing unknowns before committing to the full rewrite:

1. Vite + React Router shell with `/:lang` i18n (th/en) rendering one public page
   and one detail page (`/:lang/remedies/:id`) fetching `/api` via React Query.
2. nginx `try_files … /index.html` + `/api` proxy → deep-link `/:lang/remedies/:id`
   loads correctly.
3. `StaffGuard` probing `GET /api/v1/session` (stub) → redirect flow.

If the shell + i18n + guard feel right, promote to a full plan (`writing-plans`).

## Phased outline (after the spike)

1. **Go:** cookie auth middleware + login/logout `Set-Cookie` + `/api/v1/session`
   (keep Bearer during transition). Tests.
2. **Vite shell:** scaffold, Tailwind/base-ui wired, router tree, `/:lang` i18n,
   React Query provider, `apiFetch`, skeletons.
3. **Port public pages** to route components (list + detail), Next-import swaps.
4. **Port staff pages** + `StaffGuard` + login/logout against Go.
5. **Delete** the Next `app/` tree, BFF routes, `bff-forward.ts`, `proxy.ts`,
   Next config/deps.
6. **Frontend image → nginx** serving `dist/`; nginx config with SPA fallback.
7. **Deploy:** update `compose.prod.yaml.j2`; validate; release a `v*` tag.

## Recommended next step

Run the spike. If it holds, promote to a full implementation plan. If the rewrite
scope proves larger than the RAM saving justifies, **keep-SSR + cap-RAM** remains
the cheapest fallback (one `mem_limit` on the frontend service).
