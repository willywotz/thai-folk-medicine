"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { deleteRemedy, fetchRemedies, remedyListKey } from "@/lib/staff-queries";

export function RemedyAdminList({ healerId }: { healerId: number }) {
  const queryClient = useQueryClient();
  const { data: remedies, isLoading, isError } = useQuery({
    queryKey: remedyListKey(healerId),
    queryFn: () => fetchRemedies(healerId),
  });

  const remove = useMutation({
    mutationFn: deleteRemedy,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: remedyListKey(healerId) }),
  });

  if (isLoading) return <p className="text-stone-500">Loading…</p>;
  if (isError) return <p className="text-red-600">Could not load remedies.</p>;

  return (
    <div className="space-y-4">
      <Link
        href={`/staff/healers/${healerId}/remedies/new`}
        className="inline-block rounded bg-stone-800 px-3 py-2 text-sm text-white"
      >
        + New remedy
      </Link>
      {remove.isError ? (
        <p className="text-red-600">Could not delete this remedy. It may still have treatment cases.</p>
      ) : null}
      {!remedies || remedies.length === 0 ? (
        <EmptyState message="No remedies for this healer yet." />
      ) : (
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {remedies.map((r) => (
            <li key={r.id} className="flex items-center justify-between p-3">
              <p className="font-medium">{r.name}</p>
              <div className="flex items-center gap-3 text-sm">
                <Link href={`/staff/remedies/${r.id}/treatment-cases`} className="text-stone-700 underline">
                  Cases
                </Link>
                <Link
                  href={`/staff/healers/${healerId}/remedies/${r.id}/edit`}
                  className="text-stone-700 underline"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => remove.mutate(r.id)}
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
