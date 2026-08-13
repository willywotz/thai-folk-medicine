import type { Healer, Remedy } from "@/lib/api-types";
import type { HealerInput } from "@/lib/healer-schema";
import type { RemedyInput } from "@/lib/remedy-schema";

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
