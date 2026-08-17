import type {
  Activity,
  District,
  Healer,
  Herb,
  Page,
  Photo,
  Province,
  Remedy,
  Stats,
  TreatmentCase,
} from "@/lib/api-types";
import type { HealerInput } from "@/lib/healer-schema";
import type { HerbInput } from "@/lib/herb-schema";
import type { RemedyInput } from "@/lib/remedy-schema";
import type { TreatmentCaseInput } from "@/lib/treatment-case-schema";

export const STAFF_PAGE_SIZE = 20;

// healerListKey builds a query cache key. Called with no args it is a
// wildcard prefix (matches every page/search variant) for invalidation.
export function healerListKey(page?: number, searchTerm?: string) {
  const key: (string | number)[] = ["healers"];
  if (page !== undefined) key.push(page);
  if (searchTerm !== undefined) key.push(searchTerm);
  return key;
}

/** fetchPage reads one page of a staff list endpoint through the /api proxy. */
async function fetchPage<T>(
  path: string,
  opts: { page?: number; pageSize?: number; searchTerm?: string } = {},
): Promise<Page<T>> {
  const params = new URLSearchParams({
    page: String(opts.page ?? 1),
    pageSize: String(opts.pageSize ?? STAFF_PAGE_SIZE),
  });
  if (opts.searchTerm) params.set("searchTerm", opts.searchTerm);
  const res = await fetch(`/api/v1${path}?${params.toString()}`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`cannot load ${path}`);
  return (await res.json()) as Page<T>;
}

/** fetchHealers reads a page of the flat healer list, with optional name search. */
export async function fetchHealers(opts: { page?: number; searchTerm?: string } = {}): Promise<Page<Healer>> {
  return fetchPage<Healer>("/healers", opts);
}

/** deleteHealer removes a healer through the authenticated API. */
export async function deleteHealer(id: number): Promise<void> {
  const res = await fetch(`/api/v1/healers/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot delete healer");
}

/** createHealer posts a new healer (with its districtId) through the API. */
export async function createHealer(input: HealerInput & { districtId: number }): Promise<Healer> {
  const res = await fetch("/api/v1/healers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot create healer");
  return (await res.json()) as Healer;
}

/** updateHealer PUTs changes to a healer through the API. */
export async function updateHealer(id: number, input: HealerInput & { districtId: number }): Promise<void> {
  const res = await fetch(`/api/v1/healers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot update healer");
}

export function remedyListKey(page?: number, searchTerm?: string, healerId?: number) {
  const key: (string | number)[] = ["remedies"];
  if (page !== undefined) key.push(page);
  if (searchTerm !== undefined) key.push(searchTerm);
  if (healerId !== undefined) key.push(healerId);
  return key;
}

/** fetchRemedies reads a page of the remedy list, optionally scoped to a healer and/or searched by name. */
export async function fetchRemedies(
  opts: { page?: number; searchTerm?: string; healerId?: number } = {},
): Promise<Page<Remedy>> {
  const path = opts.healerId !== undefined ? `/healers/${opts.healerId}/remedies` : "/remedies";
  return fetchPage<Remedy>(path, opts);
}

/** createRemedy posts a new remedy (with its healerId) through the API. */
export async function createRemedy(input: RemedyInput & { healerId: number }): Promise<Remedy> {
  const res = await fetch("/api/v1/remedies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot create remedy");
  return (await res.json()) as Remedy;
}

/** updateRemedy PUTs changes to a remedy (including its healer) through the API. */
export async function updateRemedy(id: number, input: RemedyInput & { healerId: number }): Promise<void> {
  const res = await fetch(`/api/v1/remedies/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot update remedy");
}

/** deleteRemedy removes a remedy through the API. */
export async function deleteRemedy(id: number): Promise<void> {
  const res = await fetch(`/api/v1/remedies/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot delete remedy");
}

export function caseListKey(page?: number, remedyId?: number) {
  const key: (string | number)[] = ["treatment-cases"];
  if (page !== undefined) key.push(page);
  if (remedyId !== undefined) key.push(remedyId);
  return key;
}

/** fetchCases reads a page of the treatment case list, optionally scoped to a remedy (no search support). */
export async function fetchCases(opts: { page?: number; remedyId?: number } = {}): Promise<Page<TreatmentCase>> {
  const path = opts.remedyId !== undefined ? `/remedies/${opts.remedyId}/treatment-cases` : "/treatment-cases";
  return fetchPage<TreatmentCase>(path, { page: opts.page });
}

/** createCase posts a new case (with remedyId + healerId) through the API. */
export async function createCase(
  input: TreatmentCaseInput & { remedyId: number; healerId: number },
): Promise<TreatmentCase> {
  const res = await fetch("/api/v1/treatment-cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot create treatment case");
  return (await res.json()) as TreatmentCase;
}

/** updateCase PUTs changes to a case through the API (the API ignores remedy/healer on update). */
export async function updateCase(
  id: number,
  input: TreatmentCaseInput & { remedyId: number; healerId: number },
): Promise<void> {
  const res = await fetch(`/api/v1/treatment-cases/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot update treatment case");
}

/** deleteCase removes a case through the API. */
export async function deleteCase(id: number): Promise<void> {
  const res = await fetch(`/api/v1/treatment-cases/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot delete treatment case");
}

export function photoListKey(ownerType: string, ownerId: number) {
  return ["photos", ownerType, ownerId] as const;
}

/** fetchPhotos reads an owner's photos through the /api proxy. */
export async function fetchPhotos(ownerType: string, ownerId: number): Promise<Photo[]> {
  const res = await fetch(`/api/v1/photos?ownerType=${ownerType}&ownerId=${ownerId}`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot load photos");
  return (await res.json()) as Photo[];
}

/** uploadPhoto posts a multipart photo (file + owner + caption) through the API. */
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
  const res = await fetch("/api/v1/photos", {
    method: "POST",
    body: form,
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot upload photo");
}

/** deletePhoto removes a photo through the API. */
export async function deletePhoto(id: number): Promise<void> {
  const res = await fetch(`/api/v1/photos/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot delete photo");
}

export function herbListKey(page?: number, searchTerm?: string) {
  const key: (string | number)[] = ["herbs"];
  if (page !== undefined) key.push(page);
  if (searchTerm !== undefined) key.push(searchTerm);
  return key;
}

/** fetchHerbs reads a page of the herb list through the same-origin /api proxy, with optional name search. */
export async function fetchHerbs(opts: { page?: number; searchTerm?: string } = {}): Promise<Page<Herb>> {
  return fetchPage<Herb>("/herbs", opts);
}

/**
 * fetchAllHerbs loads every herb (paging at the max page size) for pickers that
 * need the whole catalogue rather than one page.
 * withinlazy: one request per 48-herb page; fine for a small reference catalogue.
 */
export async function fetchAllHerbs(): Promise<Herb[]> {
  const first = await fetchPage<Herb>("/herbs", { page: 1, pageSize: 48 });
  const all = [...first.items];
  for (let page = 2; page <= first.totalPages; page++) {
    const next = await fetchPage<Herb>("/herbs", { page, pageSize: 48 });
    all.push(...next.items);
  }
  return all;
}

/** createHerb posts a new herb through the API. */
export async function createHerb(input: HerbInput): Promise<Herb> {
  const res = await fetch("/api/v1/herbs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot create herb");
  return (await res.json()) as Herb;
}

/** updateHerb PUTs changes to a herb through the API. */
export async function updateHerb(id: number, input: HerbInput): Promise<void> {
  const res = await fetch(`/api/v1/herbs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot update herb");
}

/** deleteHerb removes a herb through the API. */
export async function deleteHerb(id: number): Promise<void> {
  const res = await fetch(`/api/v1/herbs/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot delete herb");
}

export const activityKey = ["activity"] as const;

// Reads /activity and /stats: those routes are JWT-guarded on the Go API, so
// they go through the API with credentials.
async function fetchApiList<T>(path: string, error: string): Promise<T[]> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`/api/v1${path}${sep}pageSize=48`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw new Error(error);
  return ((await res.json()) as Page<T>).items;
}

/** fetchActivity reads the persisted event feed through the authenticated API. */
export async function fetchActivity(): Promise<Activity[]> {
  return fetchApiList<Activity>("/activity", "cannot load activity");
}

export const statsKey = ["stats"] as const;

/** fetchStats reads the dashboard aggregate counts through the authenticated API. */
export async function fetchStats(): Promise<Stats> {
  const res = await fetch("/api/v1/stats", {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot load stats");
  return (await res.json()) as Stats;
}

export const provinceListKey = ["provinces"] as const;

/** fetchProvinces reads the province list through the same-origin /api proxy. */
export async function fetchProvinces(): Promise<Province[]> {
  const res = await fetch("/api/v1/provinces", {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot load provinces");
  return (await res.json()) as Province[];
}

interface ProvinceInput {
  nameThai: string;
  nameEnglish: string;
}

/** createProvince posts a new province through the API. */
export async function createProvince(input: ProvinceInput): Promise<Province> {
  const res = await fetch("/api/v1/provinces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot create province");
  return (await res.json()) as Province;
}

/** updateProvince PUTs changes to a province through the API. */
export async function updateProvince(id: number, input: ProvinceInput): Promise<void> {
  const res = await fetch(`/api/v1/provinces/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot update province");
}

/** deleteProvince removes a province through the API (409 if it still has districts). */
export async function deleteProvince(id: number): Promise<void> {
  const res = await fetch(`/api/v1/provinces/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot delete province");
}

export function districtListKey(provinceId: number) {
  return ["districts", provinceId] as const;
}

/** fetchDistricts reads a province's district list through the same-origin /api proxy. */
export async function fetchDistricts(provinceId: number): Promise<District[]> {
  const res = await fetch(`/api/v1/provinces/${provinceId}/districts`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot load districts");
  return (await res.json()) as District[];
}

interface DistrictInput {
  nameThai: string;
  nameEnglish: string;
}

/** createDistrict posts a new district (with its provinceId) through the API. */
export async function createDistrict(input: DistrictInput & { provinceId: number }): Promise<District> {
  const res = await fetch("/api/v1/districts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot create district");
  return (await res.json()) as District;
}

/** updateDistrict PUTs changes to a district through the API (no province change). */
export async function updateDistrict(id: number, input: DistrictInput): Promise<void> {
  const res = await fetch(`/api/v1/districts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot update district");
}

/** deleteDistrict removes a district through the API (409 if it still has healers). */
export async function deleteDistrict(id: number): Promise<void> {
  const res = await fetch(`/api/v1/districts/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("cannot delete district");
}
