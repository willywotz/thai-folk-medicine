import type {
  District,
  Healer,
  Province,
  Remedy,
  SearchResponse,
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

export async function listHealersByDistrict(districtId: number): Promise<Healer[]> {
  return getJson<Healer[]>(`/districts/${districtId}/healers`);
}

export async function getHealer(id: number): Promise<Healer | null> {
  return getOrNull<Healer>(`/healers/${id}`);
}

export async function listRemediesByHealer(healerId: number): Promise<Remedy[]> {
  return getJson<Remedy[]>(`/healers/${healerId}/remedies`);
}

export async function getRemedy(id: number): Promise<Remedy | null> {
  return getOrNull<Remedy>(`/remedies/${id}`);
}

export async function listCasesByRemedy(remedyId: number): Promise<TreatmentCase[]> {
  return getJson<TreatmentCase[]>(`/remedies/${remedyId}/treatment-cases`);
}

export async function getTreatmentCase(id: number): Promise<TreatmentCase | null> {
  return getOrNull<TreatmentCase>(`/treatment-cases/${id}`);
}

/** photoUrl returns a same-origin path so the browser fetches through the proxy. */
export function photoUrl(photoId: number): string {
  return `/api/v1/photos/${photoId}`;
}

export async function search(term: string): Promise<SearchResponse> {
  return getJson<SearchResponse>(`/search?searchTerm=${encodeURIComponent(term)}`);
}
