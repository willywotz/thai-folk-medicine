import type { Healer } from "@/lib/api-types";
import type { HealerInput } from "@/lib/healer-schema";

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
