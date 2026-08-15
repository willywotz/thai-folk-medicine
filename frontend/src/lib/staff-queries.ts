import type { Activity, Healer, Herb, Page, Photo, Remedy, Stats, TreatmentCase } from "@/lib/api-types";
import type { HealerInput } from "@/lib/healer-schema";
import type { HerbInput } from "@/lib/herb-schema";
import type { RemedyInput } from "@/lib/remedy-schema";
import type { TreatmentCaseInput } from "@/lib/treatment-case-schema";

export function healerListKey(districtId?: number) {
  return ["healers", districtId] as const;
}

// fetchList reads a paginated public list and returns just its items. Staff
// admin lists show every row at once, so we ask for the maximum page.
// withinlazy: pageSize is capped at 48 server-side; add real staff pagination
// if any single list can exceed 48 rows.
async function fetchList<T>(path: string, error: string): Promise<T[]> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`/api/v1${path}${sep}pageSize=48`, { cache: "no-store" });
  if (!res.ok) throw new Error(error);
  return ((await res.json()) as Page<T>).items;
}

/** fetchHealers reads the flat healer list, optionally filtered by district. */
export async function fetchHealers(districtId?: number): Promise<Healer[]> {
  const query = districtId !== undefined ? `?districtId=${districtId}` : "";
  return fetchList<Healer>(`/healers${query}`, "cannot load healers");
}

/** deleteHealer removes a healer through the authenticated BFF. */
export async function deleteHealer(id: number): Promise<void> {
  const res = await fetch(`/bff/healers/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("cannot delete healer");
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

export function remedyListKey(healerId: number) {
  return ["remedies", healerId] as const;
}

/** fetchRemedies reads a healer's remedies through the same-origin /api proxy. */
export async function fetchRemedies(healerId: number): Promise<Remedy[]> {
  return fetchList<Remedy>(`/healers/${healerId}/remedies`, "cannot load remedies");
}

/** createRemedy posts a new remedy (with its healerId) through the BFF. */
export async function createRemedy(input: RemedyInput & { healerId: number }): Promise<void> {
  const res = await fetch("/bff/remedies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("cannot create remedy");
}

/** updateRemedy PUTs changes to a remedy through the BFF (no healer change). */
export async function updateRemedy(id: number, input: RemedyInput): Promise<void> {
  const res = await fetch(`/bff/remedies/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("cannot update remedy");
}

/** deleteRemedy removes a remedy through the BFF. */
export async function deleteRemedy(id: number): Promise<void> {
  const res = await fetch(`/bff/remedies/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("cannot delete remedy");
}

export function caseListKey(remedyId: number) {
  return ["treatment-cases", remedyId] as const;
}

/** fetchCases reads a remedy's treatment cases through the /api proxy. */
export async function fetchCases(remedyId: number): Promise<TreatmentCase[]> {
  return fetchList<TreatmentCase>(
    `/remedies/${remedyId}/treatment-cases`,
    "cannot load treatment cases",
  );
}

/** createCase posts a new case (with remedyId + healerId) through the BFF. */
export async function createCase(
  input: TreatmentCaseInput & { remedyId: number; healerId: number },
): Promise<void> {
  const res = await fetch("/bff/treatment-cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("cannot create treatment case");
}

/** updateCase PUTs changes to a case through the BFF (no remedy/healer change). */
export async function updateCase(id: number, input: TreatmentCaseInput): Promise<void> {
  const res = await fetch(`/bff/treatment-cases/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("cannot update treatment case");
}

/** deleteCase removes a case through the BFF. */
export async function deleteCase(id: number): Promise<void> {
  const res = await fetch(`/bff/treatment-cases/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("cannot delete treatment case");
}

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

export const herbListKey = ["herbs"] as const;

/** fetchHerbs reads the herb list through the same-origin /api proxy. */
export async function fetchHerbs(): Promise<Herb[]> {
  return fetchList<Herb>(`/herbs`, "cannot load herbs");
}

/** createHerb posts a new herb through the BFF. */
export async function createHerb(input: HerbInput): Promise<void> {
  const res = await fetch("/bff/herbs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("cannot create herb");
}

/** updateHerb PUTs changes to a herb through the BFF. */
export async function updateHerb(id: number, input: HerbInput): Promise<void> {
  const res = await fetch(`/bff/herbs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("cannot update herb");
}

/** deleteHerb removes a herb through the BFF. */
export async function deleteHerb(id: number): Promise<void> {
  const res = await fetch(`/bff/herbs/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("cannot delete herb");
}

export const activityKey = ["activity"] as const;

// Reads /activity and /stats: those routes are JWT-guarded on the Go API, so
// they go through the BFF (cookie -> Bearer) instead of the public /api proxy
// fetchList uses.
async function fetchBffList<T>(path: string, error: string): Promise<T[]> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`/bff${path}${sep}pageSize=48`, { cache: "no-store" });
  if (!res.ok) throw new Error(error);
  return ((await res.json()) as Page<T>).items;
}

/** fetchActivity reads the persisted event feed through the authenticated BFF. */
export async function fetchActivity(): Promise<Activity[]> {
  return fetchBffList<Activity>("/activity", "cannot load activity");
}

export const statsKey = ["stats"] as const;

/** fetchStats reads the dashboard aggregate counts through the authenticated BFF. */
export async function fetchStats(): Promise<Stats> {
  const res = await fetch("/bff/stats", { cache: "no-store" });
  if (!res.ok) throw new Error("cannot load stats");
  return (await res.json()) as Stats;
}

export const provinceListKey = ["provinces"] as const;

interface ProvinceInput {
  nameThai: string;
  nameEnglish: string;
}

/** createProvince posts a new province through the BFF. */
export async function createProvince(input: ProvinceInput): Promise<void> {
  const res = await fetch("/bff/provinces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("cannot create province");
}

/** updateProvince PUTs changes to a province through the BFF. */
export async function updateProvince(id: number, input: ProvinceInput): Promise<void> {
  const res = await fetch(`/bff/provinces/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("cannot update province");
}

/** deleteProvince removes a province through the BFF (409 if it still has districts). */
export async function deleteProvince(id: number): Promise<void> {
  const res = await fetch(`/bff/provinces/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("cannot delete province");
}

export function districtListKey(provinceId: number) {
  return ["districts", provinceId] as const;
}

interface DistrictInput {
  nameThai: string;
  nameEnglish: string;
}

/** createDistrict posts a new district (with its provinceId) through the BFF. */
export async function createDistrict(input: DistrictInput & { provinceId: number }): Promise<void> {
  const res = await fetch("/bff/districts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("cannot create district");
}

/** updateDistrict PUTs changes to a district through the BFF (no province change). */
export async function updateDistrict(id: number, input: DistrictInput): Promise<void> {
  const res = await fetch(`/bff/districts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("cannot update district");
}

/** deleteDistrict removes a district through the BFF (409 if it still has healers). */
export async function deleteDistrict(id: number): Promise<void> {
  const res = await fetch(`/bff/districts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("cannot delete district");
}
