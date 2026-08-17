import type {
  District,
  Healer,
  Herb,
  Photo,
  Province,
  Remedy,
  SearchHit,
  TreatmentCase,
} from "./api-types";

const BASE = "/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(`${method} ${path}`, res.status);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const apiGet = <T>(path: string) => request<T>("GET", path);
export const apiSend = <T>(method: string, path: string, body?: unknown) => request<T>(method, path, body);

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };

async function getOrNull<T>(path: string): Promise<T | null> {
  try {
    return await apiGet<T>(path);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

function buildQuery(opts: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(opts) as [string, string | number | undefined][]) {
    if (value !== undefined) params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

interface PageOptions {
  page?: number;
  pageSize?: number;
}

export async function listProvinces(): Promise<Province[]> {
  return apiGet<Province[]>("/provinces");
}

export async function getFirstProvince(): Promise<Province | null> {
  const provinces = await listProvinces();
  return provinces[0] ?? null;
}

export async function listDistricts(provinceId: number): Promise<District[]> {
  return apiGet<District[]>(`/provinces/${provinceId}/districts`);
}

export async function getDistrict(id: number): Promise<District | null> {
  return getOrNull<District>(`/districts/${id}`);
}

export async function getProvince(id: number): Promise<Province | null> {
  return getOrNull<Province>(`/provinces/${id}`);
}

export async function listHealersByDistrict(
  districtId: number,
  opts: PageOptions = {},
): Promise<Page<Healer>> {
  return apiGet<Page<Healer>>(`/districts/${districtId}/healers${buildQuery(opts)}`);
}

export async function listHealers(
  opts: { districtId?: number } & PageOptions = {},
): Promise<Page<Healer>> {
  return apiGet<Page<Healer>>(`/healers${buildQuery(opts)}`);
}

export async function getHealer(id: number): Promise<Healer | null> {
  return getOrNull<Healer>(`/healers/${id}`);
}

export async function listRemediesByHealer(
  healerId: number,
  opts: PageOptions = {},
): Promise<Page<Remedy>> {
  return apiGet<Page<Remedy>>(`/healers/${healerId}/remedies${buildQuery(opts)}`);
}

export async function getRemedy(id: number): Promise<Remedy | null> {
  return getOrNull<Remedy>(`/remedies/${id}`);
}

export async function listCasesByRemedy(
  remedyId: number,
  opts: PageOptions = {},
): Promise<Page<TreatmentCase>> {
  return apiGet<Page<TreatmentCase>>(`/remedies/${remedyId}/treatment-cases${buildQuery(opts)}`);
}

export async function listHerbs(opts: PageOptions = {}): Promise<Page<Herb>> {
  return apiGet<Page<Herb>>(`/herbs${buildQuery(opts)}`);
}

export async function getHerb(id: number): Promise<Herb | null> {
  return getOrNull<Herb>(`/herbs/${id}`);
}

export async function listRemediesByHerb(
  herbId: number,
  opts: PageOptions = {},
): Promise<Page<Remedy>> {
  return apiGet<Page<Remedy>>(`/herbs/${herbId}/remedies${buildQuery(opts)}`);
}

export async function listRemedies(opts: PageOptions = {}): Promise<Page<Remedy>> {
  return apiGet<Page<Remedy>>(`/remedies${buildQuery(opts)}`);
}

export async function listTreatmentCases(opts: PageOptions = {}): Promise<Page<TreatmentCase>> {
  return apiGet<Page<TreatmentCase>>(`/treatment-cases${buildQuery(opts)}`);
}

export async function getTreatmentCase(id: number): Promise<TreatmentCase | null> {
  return getOrNull<TreatmentCase>(`/treatment-cases/${id}`);
}

export function photoUrl(photoId: number): string {
  return `/api/v1/photos/${photoId}`;
}

export async function listPhotosByOwner(ownerType: string, ownerId: number): Promise<Photo[]> {
  return apiGet<Photo[]>(`/photos?ownerType=${ownerType}&ownerId=${ownerId}`);
}

export async function firstPhotoUrl(ownerType: string, ownerId: number): Promise<string | undefined> {
  const photos = await listPhotosByOwner(ownerType, ownerId);
  return photos[0] ? photoUrl(photos[0].id) : undefined;
}

export async function search(term: string, opts: PageOptions = {}): Promise<Page<SearchHit>> {
  return apiGet<Page<SearchHit>>(`/search${buildQuery({ searchTerm: term, ...opts })}`);
}
