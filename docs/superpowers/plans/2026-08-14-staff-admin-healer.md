# Staff Admin — Auth + Healer Management (Next.js) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff log in and manage healers (list, create, edit, delete) through the browser, with the JWT kept in an httpOnly cookie and every write authenticated. This establishes the auth + form + mutation pattern that remedy/case/photo admin (later plans) will copy.

**Architecture:** The public site (Plan 5) stays read-only and server-rendered. The staff area adds a **BFF (backend-for-frontend) layer**: Next.js route handlers under `/bff/*` read the httpOnly `session` cookie, attach `Authorization: Bearer <token>`, and forward the write to the Go API. The browser never sees the token. Client components use **TanStack Query** (`useQuery` for the public healer list through the `/api` proxy, `useMutation` → `/bff/*` for writes) and **react-hook-form + zod + shadcn/ui** for forms. `middleware.ts` guards `/staff/*`.

**Tech Stack:** Next.js App Router + TS, Tailwind, shadcn/ui, @tanstack/react-query, react-hook-form, zod, @hookform/resolvers, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-13-thai-folk-medicine-design.md` (§7.2 write routes + auth, §10 auth, §13.2 stack). Backend: `POST /api/v1/authentication/login` → `{token}`; guarded `POST/PUT/DELETE /api/v1/healers`.

## Global Constraints

- **Node 24+, pnpm**, app in `frontend/` (already scaffolded: App Router, TS, Tailwind, Vitest, `@/*`→`./src/*`, the public pages + `src/lib/{api,api-types,format}.ts`).
- **Auth = httpOnly cookie via BFF.** The token lives ONLY in an httpOnly, `sameSite=lax`, `path=/` cookie named `session` (add `secure` in production). Client JS never reads it. Every authenticated write goes browser → `/bff/*` route handler (reads cookie, adds Bearer) → Go API. Never call the guarded Go routes directly from the browser.
- **BFF prefix is `/bff/*`** — NOT `/api/*` (that prefix is proxied to Go for public reads/photos; a `/bff` prefix has no rewrite, so the route handlers run locally). Do not add write route handlers under `/api`.
- **Route protection:** `middleware.ts` redirects any `/staff/*` request without a `session` cookie to `/login`. (The cookie's mere presence gates the UI; the Go API is the real authority — it rejects an invalid/expired token with 401, which the BFF surfaces.)
- **Validation:** zod schemas validate forms client-side (react-hook-form resolver) AND the BFF re-checks nothing it can't (the Go use case is the real validator; the BFF just forwards and maps status codes: 401→login redirect, 400→field error, 409→conflict message).
- **TanStack Query:** one `QueryClient` via a client `Providers` component. Mutations invalidate the relevant `useQuery` key on success so lists refresh.
- **shadcn/ui:** initialize it; if the CLI is interactive/unavailable in this environment, hand-write the small primitives (`button`, `input`, `label`, `textarea`, `card`) as plain Tailwind components under `src/components/ui/` following shadcn's API, and note the substitution. Do not block on the CLI.
- **Accessibility:** labels tied to inputs, error text with `aria`, real buttons, focus states.
- **TDD (adapted for React):** zod schemas + pure helpers → Vitest unit tests; forms/components → React Testing Library (mock `fetch`/mutations); route handlers get a light logic test where practical. Server-rendered pages get a smoke check.
- **Commits:** Conventional Commits, one per task. **Branch:** `feat/staff-admin-frontend`. No secrets committed.

---

### Task 1: Auth foundation — deps, providers, session, BFF login, middleware, login page

**Files:**
- Modify: `frontend/package.json` (deps), shadcn config/components
- Create: `frontend/src/app/providers.tsx`
- Modify: `frontend/src/app/layout.tsx` (wrap in Providers)
- Create: `frontend/src/lib/session.ts`
- Create: `frontend/src/lib/auth-schema.ts`
- Test: `frontend/src/lib/auth-schema.test.ts`
- Create: `frontend/src/app/bff/session/route.ts`
- Create: `frontend/src/middleware.ts`
- Create: `frontend/src/app/login/page.tsx`
- Create: `frontend/src/components/LoginForm.tsx`
- Test: `frontend/src/components/LoginForm.test.tsx`

**Interfaces:**
- Produces: `session.getSessionToken(): Promise<string | null>`, `session.setSession(token: string): Promise<void>`, `session.clearSession(): Promise<void>` (server-only, use `next/headers` cookies).
- Produces: `loginSchema` (zod) with `username` and `password` non-empty; `LoginInput` type.
- Produces: `POST /bff/session` (login → sets cookie), `DELETE /bff/session` (logout → clears cookie).
- Produces: `Providers` (client) wrapping children in `QueryClientProvider`.
- Produces: `LoginForm` (client) — rhf + zod + shadcn, posts to `/bff/session`, on success `router.push("/staff")`.

- [ ] **Step 1: Install deps and shadcn primitives**

```bash
cd frontend
pnpm add @tanstack/react-query react-hook-form zod @hookform/resolvers
pnpm dlx shadcn@latest init -d || echo "shadcn init non-interactive failed — hand-write primitives (see constraint)"
pnpm dlx shadcn@latest add button input label textarea card || echo "add failed — hand-write primitives"
```

If the CLI could not run non-interactively, create minimal `src/components/ui/{button,input,label,textarea,card}.tsx` as plain Tailwind components exporting the same names shadcn uses (`Button`, `Input`, `Label`, `Textarea`, `Card`, `CardHeader`, `CardTitle`, `CardContent`). Record which path you took in the report.

- [ ] **Step 2: Write the QueryClient provider**

Create `frontend/src/app/providers.tsx`:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

Wrap the app: in `frontend/src/app/layout.tsx`, import `Providers` and wrap `{children}` inside `<body>` with `<Providers>{children}</Providers>` (keep the existing header/main shell inside or around it — Providers must be an ancestor of any component using TanStack Query).

- [ ] **Step 3: Write the failing auth-schema test**

Create `frontend/src/lib/auth-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { loginSchema } from "./auth-schema";

describe("loginSchema", () => {
  it("accepts a filled form", () => {
    expect(loginSchema.safeParse({ username: "admin", password: "secret" }).success).toBe(true);
  });

  it("rejects an empty username", () => {
    expect(loginSchema.safeParse({ username: "", password: "secret" }).success).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ username: "admin", password: "" }).success).toBe(false);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd frontend && pnpm test src/lib/auth-schema.test.ts`
Expected: FAIL (cannot resolve `./auth-schema`).

- [ ] **Step 5: Write the schema**

Create `frontend/src/lib/auth-schema.ts`:

```ts
import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
```

- [ ] **Step 6: Write the session helpers**

Create `frontend/src/lib/session.ts`:

```ts
import { cookies } from "next/headers";

const COOKIE_NAME = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24; // one day, matches the JWT TTL

/** getSessionToken returns the staff JWT from the httpOnly cookie, or null. */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

/** setSession stores the JWT in an httpOnly cookie. */
export async function setSession(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** clearSession removes the session cookie. */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
```

- [ ] **Step 7: Write the BFF session route (login + logout)**

Create `frontend/src/app/bff/session/route.ts`:

```ts
import { NextResponse } from "next/server";

import { clearSession, setSession } from "@/lib/session";

const base = process.env.INTERNAL_API_URL ?? "http://localhost:8080";

/** POST /bff/session — log in: exchange credentials for a token, store it httpOnly. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.username !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "username and password are required" }, { status: 400 });
  }

  const res = await fetch(`${base}/api/v1/authentication/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: body.username, password: body.password }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    return NextResponse.json({ error: "no token returned" }, { status: 502 });
  }
  await setSession(data.token);
  return NextResponse.json({ ok: true });
}

/** DELETE /bff/session — log out. */
export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 8: Write the route guard**

Create `frontend/src/middleware.ts`:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Redirects /staff/* requests without a session cookie to /login. */
export function middleware(request: NextRequest) {
  if (request.cookies.has("session")) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/staff/:path*"],
};
```

- [ ] **Step 9: Write the failing login-form test**

Create `frontend/src/components/LoginForm.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

import { LoginForm } from "./LoginForm";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function fillAndSubmit() {
  return (async () => {
    await userEvent.type(screen.getByLabelText(/username/i), "admin");
    await userEvent.type(screen.getByLabelText(/password/i), "secret");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
  })();
}

describe("LoginForm", () => {
  it("shows validation errors on empty submit", async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByText(/username is required/i)).toBeInTheDocument();
  });

  it("posts credentials and redirects on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })) as unknown as typeof fetch,
    );
    render(<LoginForm />);
    await fillAndSubmit();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/staff"));
  });

  it("shows an error on bad credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: "invalid credentials" }) })) as unknown as typeof fetch,
    );
    render(<LoginForm />);
    await fillAndSubmit();
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Run the test to verify it fails**

Run: `cd frontend && pnpm test src/components/LoginForm.test.tsx`
Expected: FAIL (`LoginForm` not found).

- [ ] **Step 11: Write the login form and page**

Create `frontend/src/components/LoginForm.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";

import { loginSchema, type LoginInput } from "@/lib/auth-schema";

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setServerError("");
    const res = await fetch("/bff/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      setServerError("Invalid credentials.");
      return;
    }
    router.push("/staff");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-sm space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="username" className="text-sm font-medium">
          Username
        </label>
        <input
          id="username"
          className="w-full rounded border border-stone-300 p-2"
          {...register("username")}
        />
        {errors.username ? <p className="text-sm text-red-600">{errors.username.message}</p> : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="w-full rounded border border-stone-300 p-2"
          {...register("password")}
        />
        {errors.password ? <p className="text-sm text-red-600">{errors.password.message}</p> : null}
      </div>
      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded bg-stone-800 p-2 text-white disabled:opacity-50"
      >
        Log in
      </button>
    </form>
  );
}
```

Note: this uses plain Tailwind inputs so the test and build do not depend on the shadcn CLI having produced `ui/*`. If you DID generate shadcn primitives in Step 1, you may swap the raw `<input>`/`<button>` for `<Input>`/`<Button>` — but keep the `<label htmlFor>` associations (the tests query by label text and button name).

Create `frontend/src/app/login/page.tsx`:

```tsx
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <section>
      <h1 className="mb-6 text-center text-2xl font-bold">Staff login</h1>
      <LoginForm />
    </section>
  );
}
```

- [ ] **Step 12: Verify tests, lint, build**

Run: `cd frontend && pnpm test && pnpm lint && pnpm build`
Expected: schema + login-form tests PASS (plus all prior); lint clean; build succeeds (the `/bff/session` route and `/login` page compile; middleware compiles).

- [ ] **Step 13: Commit** (orchestrator commits.)

---

### Task 2: Staff dashboard, healer list, delete, logout

**Files:**
- Create: `frontend/src/lib/staff-queries.ts` (query keys + client fetchers)
- Create: `frontend/src/app/bff/healers/[healerId]/route.ts` (DELETE now; PUT added in Task 3)
- Create: `frontend/src/lib/bff-forward.ts` (shared cookie→Bearer forwarder)
- Test: `frontend/src/lib/staff-queries.test.ts`
- Create: `frontend/src/app/staff/layout.tsx` (shell + logout)
- Create: `frontend/src/app/staff/page.tsx` (districts dashboard — server component)
- Create: `frontend/src/app/staff/districts/[districtId]/page.tsx` (server wrapper)
- Create: `frontend/src/components/HealerAdminList.tsx` (client: useQuery + delete useMutation)
- Test: `frontend/src/components/HealerAdminList.test.tsx`
- Create: `frontend/src/components/LogoutButton.tsx`

**Interfaces:**
- Produces: `bffForward(method, path, token, body?)` helper (server) → `{ status, data }` calling the Go API with Bearer.
- Produces: `staff-queries.ts`: `healerListKey(districtId)`, `fetchHealers(districtId): Promise<Healer[]>` (client fetch through the `/api` proxy), `deleteHealer(id): Promise<void>` (POST-less; `fetch('/bff/healers/'+id, {method:'DELETE'})`).
- Produces: `DELETE /bff/healers/{healerId}` route.
- Produces: `HealerAdminList({ districtId })` — lists healers, each with Edit link (`/staff/districts/{districtId}/healers/{id}/edit`) + Delete button; a "New healer" link.

- [ ] **Step 1: Write the shared BFF forwarder + healer DELETE route**

Create `frontend/src/lib/bff-forward.ts`:

```ts
const base = process.env.INTERNAL_API_URL ?? "http://localhost:8080";

/** bffForward calls the Go API with a Bearer token and returns status + parsed body. */
export async function bffForward(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, data };
}
```

Create `frontend/src/app/bff/healers/[healerId]/route.ts`:

```ts
import { NextResponse } from "next/server";

import { bffForward } from "@/lib/bff-forward";
import { getSessionToken } from "@/lib/session";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ healerId: string }> },
) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const { healerId } = await params;
  const { status, data } = await bffForward("DELETE", `/healers/${healerId}`, token);
  if (status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(data ?? {}, { status });
}
```

- [ ] **Step 2: Write the failing staff-queries test**

Create `frontend/src/lib/staff-queries.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteHealer, fetchHealers, healerListKey } from "./staff-queries";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("healerListKey", () => {
  it("namespaces by district", () => {
    expect(healerListKey(3)).toEqual(["healers", 3]);
  });
});

describe("fetchHealers", () => {
  it("reads the proxied list endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [{ id: 1 }] }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const got = await fetchHealers(3);
    expect(got).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/districts/3/healers", expect.anything());
  });
});

describe("deleteHealer", () => {
  it("DELETEs through the bff and throws on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 409 })) as unknown as typeof fetch);
    await expect(deleteHealer(1)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && pnpm test src/lib/staff-queries.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Write the staff queries**

Create `frontend/src/lib/staff-queries.ts`:

```ts
import type { Healer } from "@/lib/api-types";

export function healerListKey(districtId: number) {
  return ["healers", districtId] as const;
}

/** fetchHealers reads the public healer list through the same-origin /api proxy. */
export async function fetchHealers(districtId: number): Promise<Healer[]> {
  const res = await fetch(`/api/v1/districts/${districtId}/healers`, { cache: "no-store" });
  if (!res.ok) throw new Error("cannot load healers");
  return (await res.json()) as Healer[];
}

/** deleteHealer removes a healer through the authenticated BFF. */
export async function deleteHealer(id: number): Promise<void> {
  const res = await fetch(`/bff/healers/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("cannot delete healer");
}
```

- [ ] **Step 5: Write the failing HealerAdminList test**

Create `frontend/src/components/HealerAdminList.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HealerAdminList } from "./HealerAdminList";

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("HealerAdminList", () => {
  it("lists healers with edit and delete controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => [{ id: 1, districtId: 3, fullName: "หมอ ก", specialty: "" }] })) as unknown as typeof fetch,
    );
    renderWithClient(<HealerAdminList districtId={3} />);
    expect(await screen.findByText("หมอ ก")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /edit/i })).toHaveAttribute(
      "href",
      "/staff/districts/3/healers/1/edit",
    );
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("removes a healer after delete", async () => {
    let deleted = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, opts?: { method?: string }) => {
        if (opts?.method === "DELETE") {
          deleted = true;
          return { ok: true, status: 204 };
        }
        return { ok: true, json: async () => (deleted ? [] : [{ id: 1, districtId: 3, fullName: "หมอ ก", specialty: "" }]) };
      }) as unknown as typeof fetch,
    );
    renderWithClient(<HealerAdminList districtId={3} />);
    await screen.findByText("หมอ ก");
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => expect(screen.queryByText("หมอ ก")).toBeNull());
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd frontend && pnpm test src/components/HealerAdminList.test.tsx`
Expected: FAIL (`HealerAdminList` not found).

- [ ] **Step 7: Write the client list component**

Create `frontend/src/components/HealerAdminList.tsx`:

```tsx
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { deleteHealer, fetchHealers, healerListKey } from "@/lib/staff-queries";

export function HealerAdminList({ districtId }: { districtId: number }) {
  const queryClient = useQueryClient();
  const { data: healers, isLoading, isError } = useQuery({
    queryKey: healerListKey(districtId),
    queryFn: () => fetchHealers(districtId),
  });

  const remove = useMutation({
    mutationFn: deleteHealer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: healerListKey(districtId) }),
  });

  if (isLoading) return <p className="text-stone-500">Loading…</p>;
  if (isError) return <p className="text-red-600">Could not load healers.</p>;

  return (
    <div className="space-y-4">
      <Link
        href={`/staff/districts/${districtId}/healers/new`}
        className="inline-block rounded bg-stone-800 px-3 py-2 text-sm text-white"
      >
        + New healer
      </Link>
      {!healers || healers.length === 0 ? (
        <EmptyState message="No healers in this district yet." />
      ) : (
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {healers.map((h) => (
            <li key={h.id} className="flex items-center justify-between p-3">
              <div>
                <p className="font-medium">{h.fullName}</p>
                {h.specialty ? <p className="text-sm text-stone-500">{h.specialty}</p> : null}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Link
                  href={`/staff/districts/${districtId}/healers/${h.id}/edit`}
                  className="text-stone-700 underline"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => remove.mutate(h.id)}
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

- [ ] **Step 8: Write the logout button + staff shell + pages**

Create `frontend/src/components/LogoutButton.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/bff/session", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }
  return (
    <button type="button" onClick={logout} className="text-sm text-stone-600 underline">
      Log out
    </button>
  );
}
```

Create `frontend/src/app/staff/layout.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/LogoutButton";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between border-b border-stone-200 pb-3">
        <Link href="/staff" className="font-semibold">
          Staff · Manage records
        </Link>
        <LogoutButton />
      </div>
      {children}
    </div>
  );
}
```

Create `frontend/src/app/staff/page.tsx` (districts dashboard — server component, reuses the public API client):

```tsx
import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { getFirstProvince, listDistricts } from "@/lib/api";

export default async function StaffDashboard() {
  const province = await getFirstProvince();
  if (!province) return <EmptyState message="No province data." />;
  const districts = await listDistricts(province.id);

  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">Choose a district to manage its healers</h1>
      <ul className="grid gap-2 sm:grid-cols-2">
        {districts.map((d) => (
          <li key={d.id}>
            <Link
              href={`/staff/districts/${d.id}`}
              className="block rounded border border-stone-200 bg-white p-3 hover:border-stone-400"
            >
              {d.nameThai} <span className="text-stone-500">· {d.nameEnglish}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Create `frontend/src/app/staff/districts/[districtId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { HealerAdminList } from "@/components/HealerAdminList";

export default async function StaffDistrictPage({
  params,
}: {
  params: Promise<{ districtId: string }>;
}) {
  const { districtId } = await params;
  const id = Number(districtId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">Healers in this district</h1>
      <HealerAdminList districtId={id} />
    </section>
  );
}
```

- [ ] **Step 9: Verify tests, lint, build**

Run: `cd frontend && pnpm test && pnpm lint && pnpm build`
Expected: staff-queries + HealerAdminList tests PASS (plus prior); lint clean; build succeeds.

- [ ] **Step 10: Commit** (orchestrator commits.)

---

### Task 3: Healer create/edit form + BFF POST/PUT

**Files:**
- Create: `frontend/src/lib/healer-schema.ts`
- Test: `frontend/src/lib/healer-schema.test.ts`
- Modify: `frontend/src/lib/staff-queries.ts` (add `createHealer`, `updateHealer`, `fetchHealer`)
- Modify: `frontend/src/app/bff/healers/route.ts` (POST) — new file
- Modify: `frontend/src/app/bff/healers/[healerId]/route.ts` (add PUT)
- Create: `frontend/src/components/HealerForm.tsx`
- Test: `frontend/src/components/HealerForm.test.tsx`
- Create: `frontend/src/app/staff/districts/[districtId]/healers/new/page.tsx`
- Create: `frontend/src/app/staff/districts/[districtId]/healers/[healerId]/edit/page.tsx`

**Interfaces:**
- Produces: `healerSchema` (zod): `fullName` non-empty; `subDistrict`, `specialty`, `biography` optional strings.
- Produces: `POST /bff/healers` (create), `PUT /bff/healers/{healerId}` (update).
- Produces: `staff-queries.ts` additions — `createHealer(input)`, `updateHealer(id, input)`, `fetchHealer(id)`.
- Produces: `HealerForm({ districtId, healer? })` — rhf + zod; on submit calls create or update mutation, invalidates the list, and navigates back to the district page.

- [ ] **Step 1: Write the failing healer-schema test**

Create `frontend/src/lib/healer-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { healerSchema } from "./healer-schema";

describe("healerSchema", () => {
  it("requires a full name", () => {
    expect(healerSchema.safeParse({ fullName: "", subDistrict: "", specialty: "", biography: "" }).success).toBe(false);
  });

  it("accepts a minimal healer", () => {
    const parsed = healerSchema.safeParse({ fullName: "หมอ ก", subDistrict: "", specialty: "", biography: "" });
    expect(parsed.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm test src/lib/healer-schema.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the schema**

Create `frontend/src/lib/healer-schema.ts`:

```ts
import { z } from "zod";

export const healerSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  subDistrict: z.string(),
  specialty: z.string(),
  biography: z.string(),
});

export type HealerInput = z.infer<typeof healerSchema>;
```

- [ ] **Step 4: Add the create/update/fetch queries**

Append to `frontend/src/lib/staff-queries.ts`:

```ts
import type { HealerInput } from "@/lib/healer-schema";

/** fetchHealer reads one healer (public) for the edit form. */
export async function fetchHealer(id: number): Promise<Healer> {
  const res = await fetch(`/api/v1/healers/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("cannot load healer");
  return (await res.json()) as Healer;
}

/** createHealer posts a new healer (with its districtId) through the BFF. */
export async function createHealer(input: HealerInput & { districtId: number }): Promise<void> {
  const res = await fetch("/bff/healers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("cannot create healer");
}

/** updateHealer PUTs changes to a healer through the BFF. */
export async function updateHealer(id: number, input: HealerInput & { districtId: number }): Promise<void> {
  const res = await fetch(`/bff/healers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("cannot update healer");
}
```

Note: the backend `POST /healers` expects `districtId` + `fullName` (+ optional fields); `PUT /healers/{id}` also expects `districtId` (a healer keeps its district — pass the same one). Include `districtId` in both payloads.

- [ ] **Step 5: Write the BFF create + update routes**

Create `frontend/src/app/bff/healers/route.ts`:

```ts
import { NextResponse } from "next/server";

import { bffForward } from "@/lib/bff-forward";
import { getSessionToken } from "@/lib/session";

export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { status, data } = await bffForward("POST", "/healers", token, body);
  return NextResponse.json(data ?? {}, { status });
}
```

Add a `PUT` export to `frontend/src/app/bff/healers/[healerId]/route.ts` (alongside the existing `DELETE`):

```ts
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ healerId: string }> },
) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const { healerId } = await params;
  const body = await request.json().catch(() => null);
  const { status, data } = await bffForward("PUT", `/healers/${healerId}`, token, body);
  return NextResponse.json(data ?? {}, { status });
}
```

- [ ] **Step 6: Write the failing HealerForm test**

Create `frontend/src/components/HealerForm.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { HealerForm } from "./HealerForm";

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("HealerForm (create)", () => {
  it("validates the required name", async () => {
    renderWithClient(<HealerForm districtId={3} />);
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/full name is required/i)).toBeInTheDocument();
  });

  it("posts a new healer and navigates back", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ id: 9 }) }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    renderWithClient(<HealerForm districtId={3} />);
    await userEvent.type(screen.getByLabelText(/full name/i), "หมอสมชาย");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/bff/healers", expect.objectContaining({ method: "POST" })),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/staff/districts/3"));
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `cd frontend && pnpm test src/components/HealerForm.test.tsx`
Expected: FAIL (`HealerForm` not found).

- [ ] **Step 8: Write the healer form**

Create `frontend/src/components/HealerForm.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import type { Healer } from "@/lib/api-types";
import { healerSchema, type HealerInput } from "@/lib/healer-schema";
import { createHealer, healerListKey, updateHealer } from "@/lib/staff-queries";

export function HealerForm({ districtId, healer }: { districtId: number; healer?: Healer }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<HealerInput>({
    resolver: zodResolver(healerSchema),
    defaultValues: {
      fullName: healer?.fullName ?? "",
      subDistrict: healer?.subDistrict ?? "",
      specialty: healer?.specialty ?? "",
      biography: healer?.biography ?? "",
    },
  });

  const save = useMutation({
    mutationFn: (values: HealerInput) =>
      healer
        ? updateHealer(healer.id, { ...values, districtId })
        : createHealer({ ...values, districtId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healerListKey(districtId) });
      router.push(`/staff/districts/${districtId}`);
      router.refresh();
    },
  });

  const field = "w-full rounded border border-stone-300 p-2";

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} className="max-w-lg space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="fullName" className="text-sm font-medium">
          Full name (ชื่อ)
        </label>
        <input id="fullName" className={field} {...register("fullName")} />
        {errors.fullName ? <p className="text-sm text-red-600">{errors.fullName.message}</p> : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="subDistrict" className="text-sm font-medium">
          Sub-district (ตำบล/หมู่บ้าน)
        </label>
        <input id="subDistrict" className={field} {...register("subDistrict")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="specialty" className="text-sm font-medium">
          Specialty (ความชำนาญ)
        </label>
        <input id="specialty" className={field} {...register("specialty")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="biography" className="text-sm font-medium">
          Biography (ประวัติ)
        </label>
        <textarea id="biography" rows={4} className={field} {...register("biography")} />
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
          onClick={() => router.push(`/staff/districts/${districtId}`)}
          className="rounded border border-stone-300 px-4 py-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 9: Write the new + edit pages**

Create `frontend/src/app/staff/districts/[districtId]/healers/new/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { HealerForm } from "@/components/HealerForm";

export default async function NewHealerPage({
  params,
}: {
  params: Promise<{ districtId: string }>;
}) {
  const { districtId } = await params;
  const id = Number(districtId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">New healer</h1>
      <HealerForm districtId={id} />
    </section>
  );
}
```

Create `frontend/src/app/staff/districts/[districtId]/healers/[healerId]/edit/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { HealerForm } from "@/components/HealerForm";
import { getHealer } from "@/lib/api";

export default async function EditHealerPage({
  params,
}: {
  params: Promise<{ districtId: string; healerId: string }>;
}) {
  const { districtId, healerId } = await params;
  const dId = Number(districtId);
  const hId = Number(healerId);
  if (!Number.isInteger(dId) || dId <= 0 || !Number.isInteger(hId) || hId <= 0) notFound();

  const healer = await getHealer(hId);
  if (!healer) notFound();

  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">Edit healer</h1>
      <HealerForm districtId={dId} healer={healer} />
    </section>
  );
}
```

- [ ] **Step 10: Verify tests, lint, build**

Run: `cd frontend && pnpm test && pnpm lint && pnpm build`
Expected: all tests PASS; lint clean; build succeeds (new/edit pages + BFF POST/PUT compile).

- [ ] **Step 11: Manual smoke (optional, needs API + Docker)**

```bash
# backend: STAFF_ADMIN_USERNAME=admin STAFF_ADMIN_PASSWORD=secret ... go run ./cmd/api  (with Postgres up)
# frontend: INTERNAL_API_URL=http://localhost:8080 pnpm dev
# visit /staff → redirected to /login → log in → pick a district → add/edit/delete a healer
```

- [ ] **Step 12: Commit** (orchestrator commits.)

---

## Self-Review

**Spec coverage (auth + healer admin slice):**
- Staff login returning a token, kept safe (spec §10) — Task 1, httpOnly cookie via `/bff/session`. ✓
- Guarded writes (spec §7.2) — every write forwarded with Bearer through `/bff/*`; the browser never holds the token. ✓
- Stack: TanStack Query + react-hook-form + zod + shadcn/ui (spec §13.2) — Tasks 1–3. ✓
- Route protection — `middleware.ts` guards `/staff/*`. ✓
- Healer CRUD UI — Tasks 2–3. ✓
- Deferred by design: remedy/case admin (next plan), photo upload UI (later), search. ✓

**Placeholder scan:** No TBD/TODO. Real code every step. Concrete error handling (401→login, failed mutation→message, empty→EmptyState, invalid id→notFound). shadcn-CLI risk has an explicit hand-write fallback.

**Type consistency:** `healerSchema`/`HealerInput` fields match the backend `healerRequest` (fullName, subDistrict, specialty, biography) + `districtId` added in the payload. `Healer` type reused from Plan 5. `healerListKey(districtId)` is used identically by the list query and every mutation's `invalidateQueries`. `/bff/healers` (POST) and `/bff/healers/{id}` (PUT/DELETE) match the client fetchers in `staff-queries.ts`. `bffForward` + `getSessionToken` are shared by all three healer BFF routes. Session cookie name `session` matches `middleware.ts`'s `cookies.has("session")`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-14-staff-admin-healer.md`.
