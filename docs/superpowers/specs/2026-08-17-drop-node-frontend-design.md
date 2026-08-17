# Drop the Node Frontend — BFF→Go + Static (CSR) Frontend — Design

Date: 2026-08-17
Status: Design for review. **A de-risking spike is required before an implementation plan** (see Risks).

## Goal

Remove the Node.js process from production to save RAM. Serve the frontend as
static files from nginx, move the BFF proxy and cookie/session auth into the Go
backend, and let the browser call `/api` directly (nginx proxies it to Go).

## Decisions (from the design conversation)

- Public pages render **client-side (CSR)** — client components fetch `/api` in
  the browser. Mitigate perceived performance with **route-based code splitting**
  and **skeleton screens**, not SSR.
- **SEO / SSR first-paint on the public site is knowingly given up.** If it later
  matters, the upgrade path is SSG (prerender at build + rebuild-on-publish); it
  is out of scope here.
- Staff zone is client-rendered too (behind auth; SEO irrelevant).
- Keep the CI/CD image-based release flow: the frontend image simply becomes an
  nginx image serving the static export.

## Current state (what Node does today, and where it goes)

| Node does today | Moves to |
| --- | --- |
| 17 BFF route handlers (`app/bff/*`), cookie→`Authorization: Bearer` | **Go** reads the JWT from the `session` cookie; browser calls `/api` directly |
| Login stores JWT via `setSession` (httpOnly cookie) | **Go** login endpoint sets the httpOnly cookie (`Set-Cookie`) |
| `proxy.ts` middleware: locale redirect | **nginx** (`/` → `/th/`) |
| `proxy.ts` middleware: `/staff/*` guard | **client-side** guard (SPA probes `/api/v1/session`) |
| `/api/:path*` rewrite (baked at build) | **nginx** `location /api { proxy_pass backend }` |
| SSR of public pages | **client fetch** via React Query (already a dependency) |

The Go backend already does Bearer-JWT auth (`bffForward` sends
`Authorization: Bearer <jwt>`), so the auth model does not change — only *where*
the JWT is read (cookie instead of a header the BFF added).

## Target architecture

```
browser ──HTTPS──> edge/host nginx (:80, TLS in front)
                      │
                      └─> frontend container (nginx:alpine, :14285)
                            ├─ /                serve static export (out/)
                            ├─ /_next/static    serve static assets
                            └─ /api/*           proxy_pass http://backend:8080
                                                   (Go reads the session cookie)
```

No Node at runtime. The frontend container is nginx serving the exported files
and proxying `/api` to the `backend` service on the compose network. Postgres and
the Go backend are unchanged.

## Component changes

### Go backend

1. **Cookie auth middleware:** accept the JWT from the `session` cookie **and**
   (for a transition window) the `Authorization: Bearer` header. Same validation,
   same claims.
2. **Login** (`POST /api/v1/auth/login`): on success respond with
   `Set-Cookie: session=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`
   instead of returning the JWT for the frontend to store.
3. **Logout** (`POST /api/v1/auth/logout`): clear the cookie.
4. **Session probe** (`GET /api/v1/session`): return the current staff identity
   (200) or 401. The SPA calls this to gate staff routes, because the httpOnly
   cookie is invisible to JS.
5. No CORS needed — same origin via nginx.

### nginx (frontend container config)

- `location = / { return 301 /th/; }` — locale default.
- `location /api/ { proxy_pass http://backend:8080; proxy_set_header Cookie $http_cookie; }`
- Static file serving with correct fallback for client routes (see Risk 1).

### Frontend (Next.js → static export, CSR)

- `next.config.ts`: `output: "export"`; remove the `rewrites()` (nginx owns `/api`).
- **Delete** all 17 `app/bff/*` route handlers and `src/lib/bff-forward.ts`.
- **Delete** `src/proxy.ts` middleware (locale → nginx; guard → client).
- Public pages become **client components** using React Query against `/api/v1/*`.
- **Code splitting:** lazy-load route segments / heavy components (`next/dynamic`).
- **Skeleton screens:** React Query `isLoading` → skeleton placeholders.
- **Client auth guard:** a `StaffGuard` wrapper calls `GET /api/v1/session`;
  while loading show a skeleton, on 401 redirect to `/login`.
- **Login form:** POST credentials to `/api/v1/auth/login` (browser stores the
  cookie automatically); on 200 navigate to `/staff`.
- i18n: `[lang]` already has `generateStaticParams`; keep `th`/`en` as the two
  build-time params. Client components read the locale from the route.

### Frontend Docker image

- Builder stage: `pnpm build` → `out/` (export output).
- Production stage: `nginx:alpine`, `COPY out /usr/share/nginx/html`, plus the
  nginx config above. No Node, no `server.js`. Runtime RAM ≈ a few MB.

### Deploy

- `compose.prod.yaml.j2`: the `frontend` service still runs the frontend image on
  `:14285` — now nginx, not Node. `INTERNAL_API_URL` is dropped (nginx config has
  the backend target). The host nginx (`/etc/nginx/conf.d/`) is unchanged.

## What we lose (accepted) and how we soften it

- **SEO + social preview meta** on public pages — initial HTML is an empty shell.
  Accepted; skeletons + code splitting address *perceived* speed, not crawlability.
- **SSR first paint** — replaced by skeletons while React Query fetches.
- If discoverability becomes a requirement, revisit with SSG (needs a
  rebuild-on-publish trigger).

## Security

- Cookie stays `HttpOnly; Secure; SameSite=Lax`. `SameSite=Lax` blocks the cookie
  on cross-site state-changing POSTs, which covers most CSRF for a JSON API. If we
  want belt-and-suspenders, add a double-submit CSRF token — defer unless needed.
- The client guard is UX only; real enforcement is Go rejecting invalid/absent
  JWTs on every `/api` call.

## Risks — resolve in a spike BEFORE writing an implementation plan

1. **`output: export` does not support dynamic route segments without
   `generateStaticParams`.** `/[lang]/remedies/[remedyId]` would force us to
   enumerate every id at build (stale = defeats CSR). **Proposed resolution:**
   convert detail pages to **query-param pages** — `/th/remedy?id=123` — a single
   static page that reads the id client-side and fetches. Spike: confirm every
   dynamic route (`remedies/[id]`, `healers/[id]`, `herbs/[id]`,
   `treatment-cases/[id]`, staff `[…]/edit`) can be restructured this way, and how
   many links/components that touches.
2. **httpOnly cookie is invisible to client JS.** The guard must probe
   `GET /api/v1/session`. Spike: confirm the flash-of-unauthenticated is
   acceptable (skeleton → redirect) and the probe latency is fine.
3. **nginx fallback for client routes** — direct loads of `/th/remedies` must
   serve the right static HTML (`try_files $uri $uri/ $uri.html /th/index.html`).
   Spike: verify Next export's file layout maps cleanly to an nginx `try_files`
   rule for both locales.
4. **Scope check:** deleting 17 BFF routes + rewriting every data-fetching page as
   a client component is a large diff. The spike sizes it.

**Measured scope (2026-08-17):** 17 BFF route files to delete; **9 UI dynamic
route segments** to restructure to query-param pages —
`remedies/[remedyId]`, `healers/[healerId]`, `herbs/[herbId]`,
`districts/[districtId]` (public) and `staff/{cases,healers,herbs,remedies}/[id]`
plus `staff/provinces/[provinceId]/districts/[districtId]` (a **nested**
double-dynamic route — the most invasive one). Every `<Link>` to these routes
changes too.

## Phased outline (after the spike de-risks the above)

1. **Go:** cookie auth middleware + login/logout `Set-Cookie` + `/api/v1/session`
   (keep Bearer support during transition). Tests.
2. **Frontend data layer:** a typed `/api` client + React Query hooks; skeletons.
3. **Public pages → CSR** (with query-param detail pages), route by route.
4. **Staff pages → CSR** + `StaffGuard` + login/logout against Go.
5. **Delete** BFF routes, `bff-forward.ts`, `proxy.ts`; drop `rewrites()`.
6. **Frontend image → nginx**; `next.config` `output: export`; nginx config.
7. **Deploy:** update `compose.prod.yaml.j2`; validate; release a `v*` tag.

## Recommended next step

Run the spike (Risks 1–3) on a throwaway branch to confirm feasibility and true
diff size. If it holds, promote this design to a full implementation plan
(`writing-plans`). If Risk 1 proves too invasive, reconsider **keep-SSR + cap-RAM**
— it remains the cheapest option and the RAM difference may not justify the churn.
