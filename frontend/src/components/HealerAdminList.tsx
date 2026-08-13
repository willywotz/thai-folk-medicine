"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { deleteHealer, fetchHealers, healerListKey } from "@/lib/staff-queries";

export function HealerAdminList({ districtId }: { districtId: number }) {
  const queryClient = useQueryClient();
  const { data: healers, isLoading, isError } = useQuery({
    queryKey: healerListKey(districtId),
    queryFn: () => fetchHealers(districtId),
  });

  const remove = useMutation({
    mutationFn: deleteHealer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: healerListKey(districtId) }),
  });

  if (isLoading) return <p className="text-stone-500">Loading…</p>;
  if (isError) return <p className="text-red-600">Could not load healers.</p>;

  return (
    <div className="space-y-4">
      <Link
        href={`/staff/districts/${districtId}/healers/new`}
        className="inline-block rounded bg-stone-800 px-3 py-2 text-sm text-white"
      >
        + New healer
      </Link>
      {!healers || healers.length === 0 ? (
        <EmptyState message="No healers in this district yet." />
      ) : (
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {healers.map((h) => (
            <li key={h.id} className="flex items-center justify-between p-3">
              <div>
                <p className="font-medium">{h.fullName}</p>
                {h.specialty ? <p className="text-sm text-stone-500">{h.specialty}</p> : null}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Link
                  href={`/staff/districts/${districtId}/healers/${h.id}/edit`}
                  className="text-stone-700 underline"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => remove.mutate(h.id)}
                  disabled={remove.isPending}
                  className="text-red-600 underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
