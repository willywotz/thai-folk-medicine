import type {
  District,
  Healer,
  Herb,
  Page,
  Photo,
  Province,
  Remedy,
  SearchHit,
  TreatmentCase,
} from "./api-types";

const base = process.env.INTERNAL_API_URL ?? "http://localhost:8080";
const apiRoot = `${base}/api/v1`;

/** ApiError carries the HTTP status of a failed API call. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiRoot}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new ApiError(`GET ${path} failed`, res.status);
  }
  return (await res.json()) as T;
}

/** getOrNull returns null on a 404, and rethrows every other error. */
async function getOrNull<T>(path: string): Promise<T | null> {
  try {
    return await getJson<T>(path);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** buildQuery renders a `?a=1&b=2` string, skipping any undefined value. */
function buildQuery(opts: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(opts) as [string, string | number | undefined][]) {
    if (value !== undefined) params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function listProvinces(): Promise<Province[]> {
  return getJson<Province[]>("/provinces");
}

export async function getFirstProvince(): Promise<Province | null> {
  const provinces = await listProvinces();
  return provinces[0] ?? null;
}

export async function listDistricts(provinceId: number): Promise<District[]> {
  return getJson<District[]>(`/provinces/${provinceId}/districts`);
}

interface PageOptions {
  page?: number;
  pageSize?: number;
}

export async function listHealersByDistrict(
  districtId: number,
  opts: PageOptions = {},
): Promise<Page<Healer>> {
  return getJson<Page<Healer>>(`/districts/${districtId}/healers${buildQuery(opts)}`);
}

export async function getHealer(id: number): Promise<Healer | null> {
  return getOrNull<Healer>(`/healers/${id}`);
}

export async function listRemediesByHealer(
  healerId: number,
  opts: PageOptions = {},
): Promise<Page<Remedy>> {
  return getJson<Page<Remedy>>(`/healers/${healerId}/remedies${buildQuery(opts)}`);
}

export async function getRemedy(id: number): Promise<Remedy | null> {
  return getOrNull<Remedy>(`/remedies/${id}`);
}

export async function listCasesByRemedy(
  remedyId: number,
  opts: PageOptions = {},
): Promise<Page<TreatmentCase>> {
  return getJson<Page<TreatmentCase>>(`/remedies/${remedyId}/treatment-cases${buildQuery(opts)}`);
}

export async function getTreatmentCase(id: number): Promise<TreatmentCase | null> {
  return getOrNull<TreatmentCase>(`/treatment-cases/${id}`);
}

interface HerbListOptions extends PageOptions {
  query?: string;
}

export async function listHerbs(opts: HerbListOptions = {}): Promise<Page<Herb>> {
  return getJson<Page<Herb>>(`/herbs${buildQuery(opts)}`);
}

export async function getHerb(id: number): Promise<Herb | null> {
  return getOrNull<Herb>(`/herbs/${id}`);
}

export async function listRemediesByHerb(
  herbId: number,
  opts: PageOptions = {},
): Promise<Page<Remedy>> {
  return getJson<Page<Remedy>>(`/herbs/${herbId}/remedies${buildQuery(opts)}`);
}

interface RemedyListOptions extends PageOptions {
  herbId?: number;
  districtId?: number;
  symptom?: string;
}

export async function listRemedies(opts: RemedyListOptions = {}): Promise<Page<Remedy>> {
  return getJson<Page<Remedy>>(`/remedies${buildQuery(opts)}`);
}

export async function listTreatmentCases(opts: PageOptions = {}): Promise<Page<TreatmentCase>> {
  return getJson<Page<TreatmentCase>>(`/treatment-cases${buildQuery(opts)}`);
}

/** photoUrl returns a same-origin path so the browser fetches through the proxy. */
export function photoUrl(photoId: number): string {
  return `/api/v1/photos/${photoId}`;
}

/** listPhotosByOwner returns the photos attached to one owner (herb, remedy, healer, or case). */
export async function listPhotosByOwner(ownerType: string, ownerId: number): Promise<Photo[]> {
  return getJson<Photo[]>(`/photos?ownerType=${ownerType}&ownerId=${ownerId}`);
}

/**
 * firstPhotoUrl returns the same-origin URL of an owner's first photo, or undefined.
 * withinlazy: one request per owner (N+1 over a list); add a batch endpoint if a
 * large grid needs covers.
 */
export async function firstPhotoUrl(ownerType: string, ownerId: number): Promise<string | undefined> {
  const photos = await listPhotosByOwner(ownerType, ownerId);
  return photos[0] ? photoUrl(photos[0].id) : undefined;
}

export async function search(term: string, opts: PageOptions = {}): Promise<Page<SearchHit>> {
  return getJson<Page<SearchHit>>(`/search${buildQuery({ searchTerm: term, ...opts })}`);
}
