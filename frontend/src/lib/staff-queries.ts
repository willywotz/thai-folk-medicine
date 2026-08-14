import type { Healer, Herb, Photo, Remedy, TreatmentCase } from "@/lib/api-types";
import type { HealerInput } from "@/lib/healer-schema";
import type { HerbInput } from "@/lib/herb-schema";
import type { RemedyInput } from "@/lib/remedy-schema";
import type { TreatmentCaseInput } from "@/lib/treatment-case-schema";

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
  const res = await fetch(`/api/v1/healers/${healerId}/remedies`, { cache: "no-store" });
  if (!res.ok) throw new Error("cannot load remedies");
  return (await res.json()) as Remedy[];
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
  const res = await fetch(`/api/v1/remedies/${remedyId}/treatment-cases`, { cache: "no-store" });
  if (!res.ok) throw new Error("cannot load treatment cases");
  return (await res.json()) as TreatmentCase[];
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
  const res = await fetch(`/api/v1/herbs`, { cache: "no-store" });
  if (!res.ok) throw new Error("cannot load herbs");
  return (await res.json()) as Herb[];
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
