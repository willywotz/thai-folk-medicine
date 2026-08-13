# Photo Management — Backend List + Staff Upload UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff upload, view, and delete photos for a healer, remedy, or treatment case. This needs one small backend addition (list photos by owner — the `withinlazy` gap from Plan 5) and a frontend photo manager wired into the staff edit pages.

**Architecture:** Backend adds a public `GET /api/v1/photos?ownerType=&ownerId=` (list-by-owner) through the existing Clean Architecture layers (domain interface → use case → sqlc repository → Gin handler). Frontend adds a `PhotoManager` client component (TanStack Query gallery + upload + delete), a `/bff/photos` multipart POST route and `/bff/photos/[photoId]` DELETE route (cookie → Bearer), and embeds the manager on the healer/remedy/case edit pages. Photo bytes still serve via the existing public `GET /api/v1/photos/{id}`.

**Tech Stack:** Go 1.26.5, Gin, pgx/v5 + sqlc, testify, testcontainers-go; Next.js App Router + TS, Tailwind, @tanstack/react-query, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-08-13-thai-folk-medicine-design.md` (§6.1 photos, §7 photo routes, §9 PhotoStore). Backend photo aggregate exists (Plan 4): `photo` table (polymorphic owner), `photo.Repository`, `PhotoService` (Upload/Get/OpenFile/Delete), guarded `POST /photos` + `DELETE /photos/{id}`, public `GET /photos/{id}`.

## Global Constraints

- **Go:** 1.26.5+. **Module:** `github.com/willywotz/thai-folk-medicine/backend`. Clean Architecture: domain/usecase import no framework code.
- **Owner types:** exactly `healer` | `remedy` | `case` (the existing `photo.ValidOwnerType` + the `photo` table CHECK). The frontend uses `"case"` (not `"treatmentcase"`) for a treatment case.
- **New backend route:** `GET /api/v1/photos?ownerType={type}&ownerId={id}` — PUBLIC (listing photo metadata is public, like the images themselves). Returns `[]` of `{id, ownerType, ownerId, caption}` (no object key leaked). Invalid `ownerType` → 400; non-numeric `ownerId` → 400.
- **Frontend auth unchanged:** upload + delete go browser → `/bff/photos*` (reads httpOnly `session` cookie, adds `Bearer`) → Go. Listing + serving use the public `/api` proxy. Token never in the browser.
- **Multipart upload:** the `/bff/photos` POST forwards the incoming `FormData` to Go with the Bearer header and NO manual `Content-Type` (let fetch set the multipart boundary). The backend caps size at 10 MiB (Plan 4) and returns 413 — surface that.
- **Delete/upload failures surfaced** in the UI (no silent-fail), consistent with the remedy/case admin.
- **TDD:** Go units red→green (repo integration via testcontainers + `TESTCONTAINERS_RYUK_DISABLED=true`; usecase + handler units); frontend schemas/queries/components via Vitest + RTL.
- **Commits:** Conventional Commits, one per task. **Branch:** `feat/photo-management`. No secrets committed.

---

### Task 1: Backend — list photos by owner

**Files:**
- Modify: `backend/internal/domain/photo/photo.go` (add `ListByOwner` to `Repository`)
- Modify: `backend/internal/adapter/repository/query/photo.sql` (add `ListPhotoByOwner`)
- Regenerate: `backend/internal/adapter/repository/db/*` (`sqlc generate`)
- Modify: `backend/internal/adapter/repository/photo_repository.go` (implement `ListByOwner`)
- Modify: `backend/internal/usecase/photo_service.go` (add `ListByOwner`)
- Modify: `backend/internal/usecase/photo_service_test.go` (add `ListByOwner` to the fake repo; add a validation test)
- Modify: `backend/internal/adapter/http/photo_handler.go` (add `ListByOwner` handler + route)
- Test: `backend/internal/adapter/repository/photo_repository_test.go` (extend)
- Test: `backend/internal/adapter/http/photo_handler_test.go` (extend)

**Interfaces:**
- Produces: `photo.Repository.ListByOwner(ctx, ownerType string, ownerID int64) ([]Photo, error)`.
- Produces: `PhotoService.ListByOwner(ctx, ownerType string, ownerID int64) ([]photo.Photo, error)` — validates `ownerType` (else `ErrInvalidPhoto`).
- Produces: `GET /api/v1/photos?ownerType=&ownerId=` handler on the public group.

- [ ] **Step 1: Add ListByOwner to the domain repository interface**

In `backend/internal/domain/photo/photo.go`, add to the `Repository` interface:

```go
	ListByOwner(ctx context.Context, ownerType string, ownerID int64) ([]Photo, error)
```

(Place it next to `Create`/`GetByID`/`Delete`.)

- [ ] **Step 2: Add the sqlc query**

Append to `backend/internal/adapter/repository/query/photo.sql`:

```sql
-- name: ListPhotoByOwner :many
SELECT id, owner_type, owner_id, object_key, caption, created_at
FROM photo
WHERE owner_type = $1 AND owner_id = $2
ORDER BY id;
```

Run: `cd backend && sqlc generate` (adds `ListPhotoByOwner` + `ListPhotoByOwnerParams`).

- [ ] **Step 3: Write the failing repository test**

Add to `backend/internal/adapter/repository/photo_repository_test.go`:

```go
func TestPhotoListByOwner(t *testing.T) {
	ctx, queries := newTestPool(t)
	repo := NewPhoto(queries)

	_, err := repo.Create(ctx, photo.CreateParams{OwnerType: photo.OwnerHealer, OwnerID: 1, ObjectKey: "a.jpg"})
	require.NoError(t, err)
	_, err = repo.Create(ctx, photo.CreateParams{OwnerType: photo.OwnerHealer, OwnerID: 1, ObjectKey: "b.jpg"})
	require.NoError(t, err)
	_, err = repo.Create(ctx, photo.CreateParams{OwnerType: photo.OwnerRemedy, OwnerID: 1, ObjectKey: "c.jpg"})
	require.NoError(t, err)

	got, err := repo.ListByOwner(ctx, photo.OwnerHealer, 1)
	require.NoError(t, err)
	assert.Len(t, got, 2)
	assert.Equal(t, photo.OwnerHealer, got[0].OwnerType)
}
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd backend && TESTCONTAINERS_RYUK_DISABLED=true go test ./internal/adapter/repository/... -run PhotoListByOwner -v`
Expected: FAIL (compile error — `ListByOwner` undefined on the repo).

- [ ] **Step 5: Implement the repository method**

Add to `backend/internal/adapter/repository/photo_repository.go`:

```go
// ListByOwner returns the photos attached to one owner.
func (r *Photo) ListByOwner(ctx context.Context, ownerType string, ownerID int64) ([]photo.Photo, error) {
	rows, err := r.q.ListPhotoByOwner(ctx, db.ListPhotoByOwnerParams{
		OwnerType: ownerType,
		OwnerID:   ownerID,
	})
	if err != nil {
		return nil, err
	}
	result := make([]photo.Photo, 0, len(rows))
	for _, row := range rows {
		result = append(result, toPhoto(row))
	}
	return result, nil
}
```

- [ ] **Step 6: Add the use case method + fix the fake + validation test**

In `backend/internal/usecase/photo_service.go`, add:

```go
// ListByOwner returns the photos of one owner after validating the owner type.
func (s *PhotoService) ListByOwner(ctx context.Context, ownerType string, ownerID int64) ([]photo.Photo, error) {
	if !photo.ValidOwnerType(ownerType) || ownerID <= 0 {
		return nil, ErrInvalidPhoto
	}
	return s.repo.ListByOwner(ctx, ownerType, ownerID)
}
```

In `backend/internal/usecase/photo_service_test.go`, add the method to `fakePhotoRepo` so it still satisfies the interface, and add a test:

```go
func (f *fakePhotoRepo) ListByOwner(_ context.Context, ownerType string, ownerID int64) ([]photo.Photo, error) {
	return []photo.Photo{{ID: 1, OwnerType: ownerType, OwnerID: ownerID}}, nil
}

func TestListByOwnerRejectsBadOwnerType(t *testing.T) {
	service := NewPhotoService(&fakePhotoRepo{}, &fakeStore{}, &photoRecorder{})
	_, err := service.ListByOwner(context.Background(), "district", 1)
	assert.ErrorIs(t, err, ErrInvalidPhoto)
}
```

Note: if the repository integration test file has its own bespoke fake or the handler test file defines a `stubPhotoRepo`, add `ListByOwner` to each so they still implement `photo.Repository`. Grep for types implementing the photo repository and update all of them.

- [ ] **Step 7: Write the failing handler test**

Add to `backend/internal/adapter/http/photo_handler_test.go` (extend `stubPhotoRepo` with `ListByOwner`, then):

```go
func TestListPhotoByOwnerEndpoint(t *testing.T) {
	router := photoRouter() // existing helper that builds a router with NewPhotoHandler
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/photos?ownerType=healer&ownerId=2", nil)
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "\"ownerType\":\"healer\"")
}

func TestListPhotoByOwnerRejectsBadType(t *testing.T) {
	router := photoRouter()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/photos?ownerType=district&ownerId=2", nil)
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}
```

Add `ListByOwner` to the handler test's `stubPhotoRepo`:

```go
func (s *stubPhotoRepo) ListByOwner(_ context.Context, ownerType string, ownerID int64) ([]photo.Photo, error) {
	return []photo.Photo{{ID: 1, OwnerType: ownerType, OwnerID: ownerID, Caption: "x"}}, nil
}
```

- [ ] **Step 8: Run the handler test to verify it fails**

Run: `cd backend && go test ./internal/adapter/http/... -run ListPhotoByOwner -v`
Expected: FAIL (compile error — handler `ListByOwner` undefined / route missing).

- [ ] **Step 9: Implement the handler + route**

In `backend/internal/adapter/http/photo_handler.go`, register the route in `RegisterRoutes` on the PUBLIC group (next to the existing `Serve`):

```go
	public.GET("/photos", h.ListByOwner)
```

Add the handler:

```go
// ListByOwner handles GET /api/v1/photos?ownerType=&ownerId=.
func (h *PhotoHandler) ListByOwner(c *gin.Context) {
	ownerType := c.Query("ownerType")
	ownerID, err := strconv.ParseInt(c.Query("ownerId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ownerId must be a number"})
		return
	}
	list, err := h.service.ListByOwner(c.Request.Context(), ownerType, ownerID)
	if err != nil {
		if errors.Is(err, usecase.ErrInvalidPhoto) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ownerType must be healer|remedy|case and ownerId must be valid"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list photos"})
		return
	}
	out := make([]photoDTO, 0, len(list))
	for _, p := range list {
		out = append(out, toPhotoDTO(p))
	}
	c.JSON(http.StatusOK, out)
}
```

Note: Gin allows `GET /photos` (static) and `GET /photos/:photoId` (param) to coexist. Verify the router builds without a panic in the tests.

- [ ] **Step 10: Verify the whole backend**

Run: `cd backend && go build ./... && go vet ./... && gofmt -l . && go mod tidy && TESTCONTAINERS_RYUK_DISABLED=true go test -count=1 ./...`
Expected: clean + every package PASS (the new repo/usecase/handler tests + all prior).

- [ ] **Step 11: Commit** (orchestrator commits.)

---

### Task 2: Frontend — BFF photo routes + PhotoManager

**Files:**
- Create: `frontend/src/app/bff/photos/route.ts` (POST multipart)
- Create: `frontend/src/app/bff/photos/[photoId]/route.ts` (DELETE)
- Modify: `frontend/src/lib/staff-queries.ts` (photo keys + fetchers)
- Test: `frontend/src/lib/staff-queries.test.ts` (extend)
- Create: `frontend/src/components/PhotoManager.tsx` + `.test.tsx`

**Interfaces:**
- Produces: `POST /bff/photos` (multipart → Go with Bearer), `DELETE /bff/photos/{photoId}`.
- Produces (in `staff-queries.ts`): `photoListKey(ownerType, ownerId)`, `fetchPhotos(ownerType, ownerId)`, `uploadPhoto({ownerType, ownerId, file, caption})`, `deletePhoto(id)`.
- Produces: `PhotoManager({ ownerType, ownerId })` — gallery (each photo via the public serve URL) + a Delete button per photo + an upload form (file + caption).

- [ ] **Step 1: Write the BFF photo routes**

Create `frontend/src/app/bff/photos/route.ts`:

```ts
import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session";

const base = process.env.INTERNAL_API_URL ?? "http://localhost:8080";

/** POST /bff/photos — forward a multipart upload to Go with the Bearer token. */
export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const form = await request.formData();
  const res = await fetch(`${base}/api/v1/photos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }, // no Content-Type: fetch sets the multipart boundary
    body: form,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return NextResponse.json(data ?? {}, { status: res.status });
}
```

Create `frontend/src/app/bff/photos/[photoId]/route.ts`:

```ts
import { NextResponse } from "next/server";

import { bffForward } from "@/lib/bff-forward";
import { getSessionToken } from "@/lib/session";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ photoId: string }> },
) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const { photoId } = await params;
  const { status, data } = await bffForward("DELETE", `/photos/${photoId}`, token);
  if (status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(data ?? {}, { status });
}
```

- [ ] **Step 2: Write the failing photo-queries test**

Add to `frontend/src/lib/staff-queries.test.ts`:

```ts
import { deletePhoto, fetchPhotos, photoListKey, uploadPhoto } from "./staff-queries";

describe("photoListKey", () => {
  it("namespaces by owner", () => {
    expect(photoListKey("healer", 2)).toEqual(["photos", "healer", 2]);
  });
});

describe("fetchPhotos", () => {
  it("reads the list endpoint with owner query", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [{ id: 1 }] }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const got = await fetchPhotos("healer", 2);
    expect(got).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/photos?ownerType=healer&ownerId=2", expect.anything());
  });
});

describe("uploadPhoto", () => {
  it("posts multipart form data to the bff", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ id: 9 }) }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const file = new File(["bytes"], "p.jpg", { type: "image/jpeg" });
    await uploadPhoto({ ownerType: "healer", ownerId: 2, file, caption: "c" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/bff/photos");
    expect((init as { method: string }).method).toBe("POST");
    expect((init as { body: unknown }).body).toBeInstanceOf(FormData);
  });
});

describe("deletePhoto", () => {
  it("throws when the bff delete fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch);
    await expect(deletePhoto(1)).rejects.toThrow();
  });
});
```

(Add these `describe` blocks to the existing file; it already imports `afterEach`/`describe`/`expect`/`it`/`vi` and calls `vi.unstubAllGlobals()` in `afterEach`.)

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && pnpm test src/lib/staff-queries.test.ts`
Expected: FAIL (photo functions undefined).

- [ ] **Step 4: Add the photo query helpers**

Append to `frontend/src/lib/staff-queries.ts`:

```ts
import type { Photo } from "@/lib/api-types";

export function photoListKey(ownerType: string, ownerId: number) {
  return ["photos", ownerType, ownerId] as const;
}

/** fetchPhotos reads an owner's photos through the /api proxy. */
export async function fetchPhotos(ownerType: string, ownerId: number): Promise<Photo[]> {
  const res = await fetch(`/api/v1/photos?ownerType=${ownerType}&ownerId=${ownerId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("cannot load photos");
  return (await res.json()) as Photo[];
}

/** uploadPhoto posts a multipart photo (file + owner + caption) through the BFF. */
export async function uploadPhoto(input: {
  ownerType: string;
  ownerId: number;
  file: File;
  caption: string;
}): Promise<void> {
  const form = new FormData();
  form.append("file", input.file);
  form.append("ownerType", input.ownerType);
  form.append("ownerId", String(input.ownerId));
  form.append("caption", input.caption);
  const res = await fetch("/bff/photos", { method: "POST", body: form });
  if (!res.ok) throw new Error("cannot upload photo");
}

/** deletePhoto removes a photo through the BFF. */
export async function deletePhoto(id: number): Promise<void> {
  const res = await fetch(`/bff/photos/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("cannot delete photo");
}
```

Note: `Photo` may already be importable via the existing `@/lib/api-types` import block — merge, don't duplicate the import line.

- [ ] **Step 5: Write the failing PhotoManager test**

Create `frontend/src/components/PhotoManager.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhotoManager } from "./PhotoManager";

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("PhotoManager", () => {
  it("shows existing photos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => [{ id: 7, ownerType: "healer", ownerId: 2, caption: "ต้นยา" }] })) as unknown as typeof fetch,
    );
    renderWithClient(<PhotoManager ownerType="healer" ownerId={2} />);
    const img = await screen.findByAltText(/ต้นยา|photo/i);
    expect(img).toHaveAttribute("src", "/api/v1/photos/7");
  });

  it("uploads a chosen file", async () => {
    const fetchMock = vi.fn(async (url: string, opts?: { method?: string }) => {
      if (opts?.method === "POST") return { ok: true, status: 201, json: async () => ({ id: 9 }) };
      return { ok: true, json: async () => [] };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    renderWithClient(<PhotoManager ownerType="healer" ownerId={2} />);

    const file = new File(["bytes"], "p.jpg", { type: "image/jpeg" });
    await userEvent.upload(screen.getByLabelText(/photo file/i), file);
    await userEvent.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/bff/photos", expect.objectContaining({ method: "POST" })),
    );
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd frontend && pnpm test src/components/PhotoManager.test.tsx`
Expected: FAIL (`PhotoManager` not found).

- [ ] **Step 7: Write the PhotoManager component**

Create `frontend/src/components/PhotoManager.tsx`:

```tsx
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { PhotoImage } from "@/components/PhotoImage";
import { deletePhoto, fetchPhotos, photoListKey, uploadPhoto } from "@/lib/staff-queries";

export function PhotoManager({ ownerType, ownerId }: { ownerType: string; ownerId: number }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const key = photoListKey(ownerType, ownerId);
  const { data: photos } = useQuery({ queryKey: key, queryFn: () => fetchPhotos(ownerType, ownerId) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("no file");
      return uploadPhoto({ ownerType, ownerId, file, caption });
    },
    onSuccess: () => {
      setCaption("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      invalidate();
    },
  });

  const remove = useMutation({ mutationFn: deletePhoto, onSuccess: invalidate });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Photos</h2>

      {photos && photos.length > 0 ? (
        <ul className="flex flex-wrap gap-4">
          {photos.map((p) => (
            <li key={p.id} className="space-y-1">
              <PhotoImage photoId={p.id} alt={p.caption || "photo"} />
              <button
                type="button"
                onClick={() => remove.mutate(p.id)}
                disabled={remove.isPending}
                className="block text-sm text-red-600 underline disabled:opacity-50"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-500">No photos yet.</p>
      )}
      {remove.isError ? <p className="text-sm text-red-600">Could not delete that photo.</p> : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          upload.mutate();
        }}
        className="space-y-2 border-t border-stone-200 pt-4"
      >
        <div className="space-y-1">
          <label htmlFor="photoFile" className="text-sm font-medium">
            Photo file
          </label>
          <input
            id="photoFile"
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="photoCaption" className="text-sm font-medium">
            Caption
          </label>
          <input
            id="photoCaption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full max-w-sm rounded border border-stone-300 p-2"
          />
        </div>
        {upload.isError ? <p className="text-sm text-red-600">Could not upload. Try again.</p> : null}
        <button
          type="submit"
          disabled={!file || upload.isPending}
          className="rounded bg-stone-800 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Upload
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 8: Verify tests, lint, build**

Run: `cd frontend && pnpm test && pnpm lint && pnpm build`
Expected: photo query + PhotoManager tests PASS (plus all prior); lint clean; build succeeds (the `/bff/photos*` routes compile).

- [ ] **Step 9: Commit** (orchestrator commits.)

---

### Task 3: Wire PhotoManager into the staff edit pages

**Files:**
- Modify: `frontend/src/app/staff/districts/[districtId]/healers/[healerId]/edit/page.tsx`
- Modify: `frontend/src/app/staff/healers/[healerId]/remedies/[remedyId]/edit/page.tsx`
- Modify: `frontend/src/app/staff/remedies/[remedyId]/treatment-cases/[treatmentCaseId]/edit/page.tsx`

**Interfaces:**
- Consumes: `PhotoManager` (Task 2). Each edit page renders it with the right `ownerType` + `ownerId`.

- [ ] **Step 1: Add PhotoManager to the healer edit page**

In `frontend/src/app/staff/districts/[districtId]/healers/[healerId]/edit/page.tsx`, import `PhotoManager` and render it below the `HealerForm`:

```tsx
import { PhotoManager } from "@/components/PhotoManager";
```

```tsx
      <HealerForm districtId={dId} healer={healer} />
      <div className="mt-8">
        <PhotoManager ownerType="healer" ownerId={healer.id} />
      </div>
```

- [ ] **Step 2: Add PhotoManager to the remedy edit page**

In `frontend/src/app/staff/healers/[healerId]/remedies/[remedyId]/edit/page.tsx`, below `RemedyForm`:

```tsx
import { PhotoManager } from "@/components/PhotoManager";
```

```tsx
      <RemedyForm healerId={hId} remedy={remedy} />
      <div className="mt-8">
        <PhotoManager ownerType="remedy" ownerId={remedy.id} />
      </div>
```

- [ ] **Step 3: Add PhotoManager to the treatment-case edit page**

In `frontend/src/app/staff/remedies/[remedyId]/treatment-cases/[treatmentCaseId]/edit/page.tsx`, below `CaseForm` (owner type is `"case"`):

```tsx
import { PhotoManager } from "@/components/PhotoManager";
```

```tsx
      <CaseForm remedyId={rId} healerId={remedy.healerId} treatmentCase={treatmentCase} />
      <div className="mt-8">
        <PhotoManager ownerType="case" ownerId={treatmentCase.id} />
      </div>
```

- [ ] **Step 4: Verify the whole frontend**

Run: `cd frontend && pnpm test && pnpm lint && pnpm build`
Expected: all tests PASS; lint clean; build succeeds (the three edit routes now embed PhotoManager, which is a client component inside a server component — allowed).

- [ ] **Step 5: Manual smoke (optional, needs API + Docker)**

```bash
# log in → edit a healer → scroll to Photos → choose an image + caption → Upload → it appears → Delete removes it
```

- [ ] **Step 6: Commit** (orchestrator commits.)

---

## Self-Review

**Spec coverage (photo management):**
- Backend list-photos-by-owner (closes the Plan 5 `withinlazy` gap) — Task 1, public `GET /api/v1/photos?ownerType=&ownerId=`. ✓
- Staff upload/gallery/delete UI (spec §7 photo routes, §9 store) — Tasks 2–3. ✓
- Upload authenticated via `/bff/photos` (multipart, Bearer server-side), delete via `/bff/photos/{id}`; serving + listing public. ✓
- Owner types healer|remedy|case; the case uses `"case"`. ✓
- Delete/upload failures surfaced; 413 (size cap) propagates as an upload error. ✓

**Placeholder scan:** No TBD/TODO. Real code every step. Multipart forwarding is explicit (no manual Content-Type). Backend validates ownerType (400) and ownerId (400).

**Type consistency:** `photo.Repository.ListByOwner` is added to the interface AND implemented in the repo AND stubbed in every fake (usecase test, handler test) — grep for photo-repo implementers. `PhotoService.ListByOwner` validates via the existing `ValidOwnerType`. The handler returns `photoDTO` (existing, no object key leaked). Frontend `photoListKey(ownerType, ownerId)` is used by the gallery query and both mutations' invalidation. `fetchPhotos` hits `/api/v1/photos?ownerType=&ownerId=` (the new backend route); `uploadPhoto` posts FormData to `/bff/photos`; `deletePhoto` → `/bff/photos/{id}`. `PhotoImage` (Plan 5) renders `/api/v1/photos/{id}`. Owner-type strings match the backend CHECK + `photo.ValidOwnerType`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-14-photo-management.md`.
