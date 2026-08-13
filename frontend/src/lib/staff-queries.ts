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
