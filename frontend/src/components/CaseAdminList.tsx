"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { formatThaiDate, patientSexLabel } from "@/lib/format";
import { caseListKey, deleteCase, fetchCases } from "@/lib/staff-queries";

export function CaseAdminList({ remedyId }: { remedyId: number }) {
  const queryClient = useQueryClient();
  const { data: cases, isLoading, isError } = useQuery({
    queryKey: caseListKey(remedyId),
    queryFn: () => fetchCases(remedyId),
  });

  const remove = useMutation({
    mutationFn: deleteCase,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: caseListKey(remedyId) }),
  });

  if (isLoading) return <p className="text-stone-500">Loading…</p>;
  if (isError) return <p className="text-red-600">Could not load treatment cases.</p>;

  return (
    <div className="space-y-4">
      <Link
        href={`/staff/remedies/${remedyId}/treatment-cases/new`}
        className="inline-block rounded bg-stone-800 px-3 py-2 text-sm text-white"
      >
        + New treatment case
      </Link>
      {remove.isError ? <p className="text-red-600">Could not delete this case.</p> : null}
      {!cases || cases.length === 0 ? (
        <EmptyState message="No treatment cases for this remedy yet." />
      ) : (
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {cases.map((c) => (
            <li key={c.id} className="flex items-center justify-between p-3">
              <div>
                <p className="font-medium">
                  {formatThaiDate(c.treatedOn)} · {patientSexLabel(c.patientSex)}, age {c.patientAge}
                </p>
                {c.result ? <p className="text-sm text-stone-500">{c.result}</p> : null}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Link
                  href={`/staff/remedies/${remedyId}/treatment-cases/${c.id}/edit`}
                  className="text-stone-700 underline"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => remove.mutate(c.id)}
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
