# Drop-Node Plan 2 — Vite SPA Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Vite + React Router SPA **foundation** in a new `web/` directory — build tooling, Tailwind v4, `/:lang` i18n, React Query data layer, `apiFetch`, `StaffGuard` (session probe), skeletons, and an nginx Docker image that serves the build and proxies `/api`. No app pages yet; those come in Plan 3.

**Architecture:** Second of three plans (see `docs/superpowers/specs/2026-08-17-drop-node-frontend-design.md`). The existing Next app in `frontend/` keeps working and shipping — `web/` is built alongside it. Plan 3 ports the 33 pages into `web/`, then cuts over (points the compose frontend image at `web/`, deletes `frontend/`). This plan is validated by `pnpm build`, unit tests (vitest), and a local nginx serve of the build — it does NOT touch compose/deploy, so production is unaffected.

**Tech Stack:** Vite 6, React 19.2.8, react-router-dom 7, @tanstack/react-query 5, Tailwind v4 (`@tailwindcss/postcss`), TypeScript 5, vitest 4 + @testing-library/react 16 + jsdom. Backed by the proven spike (`scratchpad/vite-spike`) and Plan 1's cookie auth (`GET /api/v1/authentication/session`).

**Spec:** `docs/superpowers/specs/2026-08-17-drop-node-frontend-design.md`

## Global Constraints

- New code lives under `web/` (a new top-level dir next to `frontend/` and `backend/`). Do **not** modify `frontend/` in this plan.
- Match the existing app's major versions: React `19.2.8`, Tailwind `^4`, vitest `^4`, `@vitejs/plugin-react` `^6`. Package manager: pnpm.
- Path alias `@` → `web/src` (mirror the existing `vitest.config.ts`).
- API base is same-origin `/api/v1/*`; every fetch uses `credentials: "include"` so the httpOnly `session` cookie rides along. The session probe endpoint is `GET /api/v1/authentication/session` (Plan 1).
- i18n: locales `th` (default) + `en`; reuse the existing dictionaries verbatim (copy the files).
- TDD: failing test → confirm fail → minimal code → pass. Run tests with `cd web && pnpm test`.
- The nginx image serves static files with a SPA fallback (`try_files $uri /index.html`) and proxies `/api/` to the backend — proven in the spike.

## File structure (all new, under `web/`)

```
web/
  package.json  vite.config.ts  tsconfig.json  index.html
  postcss.config.mjs  vitest.config.ts  vitest.setup.ts
  Dockerfile  nginx.conf
  src/
    main.tsx                 # router tree + providers
    index.css                # tailwind entry
    i18n/                     # config.ts + dictionaries/{th,en}.ts (copied) + provider.tsx + useT.ts
    lib/api.ts               # apiFetch + shared types
    components/
      StaffGuard.tsx
      Skeleton.tsx
    i18n/useT.test.tsx  lib/api.test.ts  components/StaffGuard.test.tsx
```

---

### Task 1: Scaffold `web/` — Vite + React + Tailwind, building green

**Files:**
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html`, `web/postcss.config.mjs`, `web/src/index.css`, `web/src/main.tsx` (temporary minimal), `web/vitest.config.ts`, `web/vitest.setup.ts`
- Create: `web/.gitignore`

**Interfaces:**
- Produces: a buildable Vite app. `pnpm --dir web build` emits `web/dist/index.html` + `web/dist/assets/*`. `pnpm --dir web test` runs vitest. Path alias `@` → `web/src`.

- [ ] **Step 1: `web/package.json`**

```json
{
  "name": "web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "pnpm": { "onlyBuiltDependencies": ["esbuild"] },
  "dependencies": {
    "@tanstack/react-query": "^5.101.4",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "react-router-dom": "^7.9.1"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.2",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^6.0.5",
    "jsdom": "^30.0.1",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vite": "^7.0.0",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: `web/vite.config.ts`** (dev proxy to backend for local `pnpm dev`)

```ts
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    proxy: { "/api": { target: "http://localhost:8080", changeOrigin: true } },
  },
});
```

- [ ] **Step 3: `web/vitest.config.ts`**

```ts
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 4: `web/vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
```

- [ ] **Step 6: `web/index.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ตำรายาหมอพื้นบ้าน</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: `web/postcss.config.mjs`** (identical to the existing app)

```js
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

- [ ] **Step 8: `web/src/index.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 9: `web/src/main.tsx`** (temporary minimal — replaced in Task 2)

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="p-8 text-xl">web scaffold ok</div>
  </StrictMode>,
);
```

- [ ] **Step 10: `web/.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 11: Install and build**

Run:
```bash
cd web && pnpm install && pnpm exec vite build
```
If pnpm blocks esbuild's build script, run `pnpm rebuild esbuild` then `pnpm exec vite build`.
Expected: `web/dist/index.html` + `web/dist/assets/*.css` (Tailwind) + `*.js` produced.

- [ ] **Step 12: Commit**

```bash
git add web/ && git commit -m "feat(web): scaffold Vite + React + Tailwind SPA foundation"
```

---

### Task 2: Router tree + `/:lang` i18n

**Files:**
- Copy: `frontend/src/lib/i18n/config.ts`, `frontend/src/lib/i18n/dictionaries/th.ts`, `frontend/src/lib/i18n/dictionaries/en.ts` → `web/src/i18n/`
- Create: `web/src/i18n/provider.tsx`, `web/src/i18n/useT.ts`
- Modify: `web/src/main.tsx`
- Test: `web/src/i18n/useT.test.tsx`

**Interfaces:**
- Consumes: the scaffold (Task 1).
- Produces:
  - `useT(): { lang: Locale; t: Dictionary }` — client hook selecting the dictionary by the `/:lang` route param.
  - `<LangLayout/>` — a layout route element that guards `:lang` (redirects unknown locales to the default) and provides the dictionary context; renders `<Outlet/>`.
  - A `createBrowserRouter` tree: `/` → redirect `/th`; `/:lang` → `LangLayout` with an index placeholder; `*` → redirect `/th`.

- [ ] **Step 1: Copy the dictionaries + config**

```bash
mkdir -p web/src/i18n/dictionaries
cp frontend/src/lib/i18n/config.ts web/src/i18n/config.ts
cp frontend/src/lib/i18n/dictionaries/th.ts web/src/i18n/dictionaries/th.ts
cp frontend/src/lib/i18n/dictionaries/en.ts web/src/i18n/dictionaries/en.ts
```
Then open the three copied files and fix any imports so they resolve within `web/src/i18n/` (they should be self-contained or import each other by relative path; adjust `@/…` paths to relative if present). Confirm `config.ts` exports `locales`, `defaultLocale`, and a locale guard (e.g. `hasLocale`), and that `dictionaries/th.ts` exports the source dictionary and `en.ts` is typed against it.

- [ ] **Step 2: Write the failing test** `web/src/i18n/useT.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { LangLayout } from "./provider";
import { useT } from "./useT";

function Probe() {
  const { lang, t } = useT();
  return <div>{lang}:{t.brandName ?? "NO_KEY"}</div>;
}

function routerAt(path: string) {
  return createMemoryRouter(
    [{ path: "/:lang", element: <LangLayout />, children: [{ index: true, element: <Probe /> }] }],
    { initialEntries: [path] },
  );
}

it("selects the Thai dictionary under /th", () => {
  render(<RouterProvider router={routerAt("/th")} />);
  expect(screen.getByText(/^th:/)).toBeInTheDocument();
});

it("selects the English dictionary under /en", () => {
  render(<RouterProvider router={routerAt("/en")} />);
  expect(screen.getByText(/^en:/)).toBeInTheDocument();
});
```

Note: replace `t.brandName` with any key that actually exists in the copied `Dictionary` (inspect `dictionaries/th.ts` and pick a real string key). If no single obvious key, use `Object.keys(t).length > 0` in the Probe instead.

- [ ] **Step 2b: Run it — expect FAIL** (`provider.tsx`/`useT.ts` don't exist yet)

Run: `cd web && pnpm test -- useT`
Expected: FAIL (module not found).

- [ ] **Step 3: `web/src/i18n/provider.tsx`**

```tsx
import { createContext, type ReactNode } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { defaultLocale, hasLocale, type Locale } from "./config";
import { dictionaries, type Dictionary } from "./dictionaries";

export const I18nContext = createContext<{ lang: Locale; t: Dictionary }>({
  lang: defaultLocale,
  t: dictionaries[defaultLocale],
});

export function LangLayout({ children }: { children?: ReactNode }) {
  const { lang } = useParams();
  if (!lang || !hasLocale(lang)) return <Navigate to={`/${defaultLocale}`} replace />;
  return (
    <I18nContext.Provider value={{ lang, t: dictionaries[lang] }}>
      {children ?? <Outlet />}
    </I18nContext.Provider>
  );
}
```

Add `web/src/i18n/dictionaries/index.ts`:

```ts
import { en } from "./en";
import { th } from "./th";
import type { Locale } from "../config";

export type Dictionary = typeof th;
export const dictionaries: Record<Locale, Dictionary> = { th, en };
```

(If the copied `th.ts`/`en.ts` use `export default` or a different export name, adjust these imports to match — inspect the files first.)

- [ ] **Step 4: `web/src/i18n/useT.ts`**

```ts
import { useContext } from "react";
import { I18nContext } from "./provider";

export function useT() {
  return useContext(I18nContext);
}
```

- [ ] **Step 5: Run the test — expect PASS**

Run: `cd web && pnpm test -- useT`
Expected: both tests PASS.

- [ ] **Step 6: Wire the router** — replace `web/src/main.tsx`

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { defaultLocale } from "./i18n/config";
import { LangLayout } from "./i18n/provider";
import "./index.css";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  { path: "/", element: <Navigate to={`/${defaultLocale}`} replace /> },
  {
    path: "/:lang",
    element: <LangLayout />,
    children: [{ index: true, element: <div className="p-8">home placeholder</div> }],
  },
  { path: "*", element: <Navigate to={`/${defaultLocale}`} replace /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 7: Build + test green**

Run: `cd web && pnpm exec vite build && pnpm test`
Expected: build succeeds; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add web/ && git commit -m "feat(web): router tree + /:lang i18n provider (dictionaries reused)"
```

---

### Task 3: Data layer, StaffGuard, Skeleton

**Files:**
- Create: `web/src/lib/api.ts`, `web/src/components/StaffGuard.tsx`, `web/src/components/Skeleton.tsx`
- Test: `web/src/lib/api.test.ts`, `web/src/components/StaffGuard.test.tsx`

**Interfaces:**
- Consumes: React Query provider (Task 2), the `/:lang` param.
- Produces:
  - `apiGet<T>(path: string): Promise<T>` and `apiSend<T>(method, path, body?)` — same-origin `/api/v1` fetch with `credentials: "include"`, throwing on non-2xx.
  - `<StaffGuard/>` — a layout route that probes `GET /api/v1/authentication/session`; shows a skeleton while pending, `<Outlet/>` on 200, `<Navigate to="/:lang/login">` on error.
  - `<Skeleton/>` — a simple pulsing placeholder block.

- [ ] **Step 1: Write the failing tests**

`web/src/lib/api.test.ts`:

```ts
import { afterEach, expect, it, vi } from "vitest";
import { apiGet } from "./api";

afterEach(() => vi.restoreAllMocks());

it("apiGet requests /api/v1 with credentials and returns json", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const data = await apiGet<{ ok: boolean }>("/remedies");
  expect(data.ok).toBe(true);
  expect(fetchMock).toHaveBeenCalledWith("/api/v1/remedies", expect.objectContaining({ credentials: "include" }));
});

it("apiGet throws on non-2xx", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 401 })));
  await expect(apiGet("/authentication/session")).rejects.toThrow();
});
```

`web/src/components/StaffGuard.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import StaffGuard from "./StaffGuard";

afterEach(() => vi.restoreAllMocks());

function renderGuard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: "/:lang",
        children: [
          { element: <StaffGuard />, children: [{ path: "staff", element: <div>SECRET</div> }] },
          { path: "login", element: <div>LOGIN PAGE</div> },
        ],
      },
    ],
    { initialEntries: ["/th/staff"] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

it("renders the guarded content when the session probe returns 200", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
  renderGuard();
  await waitFor(() => expect(screen.getByText("SECRET")).toBeInTheDocument());
});

it("redirects to login when the session probe returns 401", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status: 401 })));
  renderGuard();
  await waitFor(() => expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument());
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd web && pnpm test`
Expected: FAIL (modules not found).

- [ ] **Step 3: `web/src/lib/api.ts`**

```ts
const BASE = "/api/v1";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const apiGet = <T>(path: string) => request<T>("GET", path);
export const apiSend = <T>(method: string, path: string, body?: unknown) => request<T>(method, path, body);

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };
```

- [ ] **Step 4: `web/src/components/Skeleton.tsx`**

```tsx
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} aria-busy="true" />;
}
```

- [ ] **Step 5: `web/src/components/StaffGuard.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { apiGet } from "@/lib/api";
import { Skeleton } from "./Skeleton";

export default function StaffGuard() {
  const { lang } = useParams();
  const q = useQuery({
    queryKey: ["session"],
    retry: false,
    queryFn: () => apiGet("/authentication/session"),
  });

  if (q.isLoading) return <Skeleton className="m-8 h-24" />;
  if (q.isError) return <Navigate to={`/${lang}/login`} replace />;
  return <Outlet />;
}
```

- [ ] **Step 6: Run — expect PASS**

Run: `cd web && pnpm test`
Expected: all tests pass (api + guard).

- [ ] **Step 7: Commit**

```bash
git add web/ && git commit -m "feat(web): apiFetch, StaffGuard session probe, Skeleton"
```

---

### Task 4: nginx Docker image serving the build + `/api` proxy

**Files:**
- Create: `web/Dockerfile`, `web/nginx.conf`

**Interfaces:**
- Consumes: the buildable `web/` app.
- Produces: a `nginx:alpine` image that serves `web/dist` with a SPA fallback and proxies `/api/` to `http://backend:8080`. Not wired into compose here (Plan 3 cutover does that).

- [ ] **Step 1: `web/nginx.conf`** (proven shape from the spike)

```nginx
server {
  listen 3000;
  root /usr/share/nginx/html;

  location /api/ {
    proxy_pass http://backend:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Cookie $http_cookie;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  location / {
    try_files $uri /index.html;
  }
}
```

- [ ] **Step 2: `web/Dockerfile`** (build with Node, serve with nginx — no Node at runtime)

```dockerfile
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install
COPY . .
RUN pnpm exec vite build

FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
```

- [ ] **Step 3: Build the image**

Run:
```bash
docker build -t web-spa:test web/
```
Expected: builds through to the `production` stage (image contains `dist` + config; no Node).

- [ ] **Step 4: Serve + verify SPA fallback and asset serving**

Run (no backend needed — we only check static serving + fallback here; `/api` proxy is exercised in Plan 3 against the real stack):
```bash
docker run -d --name web-spa-test -p 8099:3000 web-spa:test
sleep 2
curl -s -o /dev/null -w "root -> %{http_code}\n" http://localhost:8099/
curl -s -o /dev/null -w "deep link -> %{http_code} %{content_type}\n" http://localhost:8099/th/remedies/123
docker rm -f web-spa-test
```
Expected: `root -> 200`; `deep link -> 200 text/html` (SPA fallback serves index.html for an unknown deep path).

- [ ] **Step 5: Commit**

```bash
git add web/Dockerfile web/nginx.conf
git commit -m "feat(web): nginx image serving the SPA build with /api proxy + SPA fallback"
```

---

### Task 5: CONTEXT.md note

**Files:**
- Modify: `CONTEXT.md`

- [ ] **Step 1:** Add a short bullet under the frontend/CI-CD area noting that a Vite SPA foundation now lives in `web/` (router, `/:lang` i18n reusing the dictionaries, React Query `apiFetch`, `StaffGuard` probing `/api/v1/authentication/session`, nginx image), built alongside the Next app in `frontend/` pending the Plan 3 page-port + cutover. Do not remove existing content.

- [ ] **Step 2: Commit**

```bash
git add CONTEXT.md && git commit -m "docs: note Vite SPA foundation in web/ (drop-node plan 2)"
```

---

## Self-Review

**Spec coverage (of Plan 2's slice):**
- Vite scaffold + Tailwind → Task 1. ✓
- Router tree + `/:lang` i18n reusing dictionaries → Task 2. ✓
- React Query + `apiFetch` (credentials include) → Task 3. ✓
- `StaffGuard` probing `GET /api/v1/authentication/session` → Task 3. ✓
- Skeleton screens (loading) → Task 3. ✓
- nginx image serving `dist` + `try_files` fallback + `/api` proxy → Task 4. ✓
- Does NOT touch `frontend/`, compose, or deploy → Global Constraints; production unaffected. ✓

**Placeholder scan:** Task 2 depends on inspecting the copied dictionaries (their export names/keys), which the steps call out explicitly with fallbacks (`Object.keys(t).length`, adjust import names) — no blocked step.

**Type/name consistency:** `apiGet`/`apiSend` names identical across `api.ts`, `StaffGuard.tsx`, and tests. Session route `GET /api/v1/authentication/session` matches Plan 1's endpoint. `useT()` / `LangLayout` / `I18nContext` names consistent across `provider.tsx`, `useT.ts`, `main.tsx`, and the test. Alias `@` → `web/src` consistent in `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`.

**Deferred to Plan 3:** porting the 33 pages, base-ui/shadcn component port, login/logout forms against Go, deleting `frontend/` + BFF, wiring the `web/` image into `compose.prod.yaml.j2`, and the release.
