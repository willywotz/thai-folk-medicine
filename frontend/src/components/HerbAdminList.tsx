"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { deleteHerb, fetchHerbs, herbListKey } from "@/lib/staff-queries";

export function HerbAdminList() {
  const queryClient = useQueryClient();
  const { data: herbs, isLoading, isError } = useQuery({ queryKey: herbListKey, queryFn: fetchHerbs });
  const remove = useMutation({
    mutationFn: deleteHerb,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: herbListKey }),
  });

  if (isLoading) return <p className="text-stone-500">Loading…</p>;
  if (isError) return <p className="text-red-600">Could not load herbs.</p>;

  return (
    <div className="space-y-4">
      {remove.isError ? (
        <p className="text-red-600">Could not delete. This herb may still be used by remedies.</p>
      ) : null}
      <Link href="/staff/herbs/new" className="inline-block rounded bg-stone-800 px-3 py-2 text-sm text-white">
        + New herb
      </Link>
      {!herbs || herbs.length === 0 ? (
        <EmptyState message="No herbs yet." />
      ) : (
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {herbs.map((h) => (
            <li key={h.id} className="flex items-center justify-between p-3">
              <div>
                <p className="font-medium">{h.nameThai}</p>
                {h.nameEnglish ? <p className="text-sm text-stone-500">{h.nameEnglish}</p> : null}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Link href={`/staff/herbs/${h.id}/edit`} className="text-stone-700 underline">
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
