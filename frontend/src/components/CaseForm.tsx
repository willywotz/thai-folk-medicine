"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import type { TreatmentCase } from "@/lib/api-types";
import { caseListKey, createCase, updateCase } from "@/lib/staff-queries";
import { treatmentCaseSchema, type TreatmentCaseInput } from "@/lib/treatment-case-schema";

// z.coerce.number() makes the schema's input type diverge from its output type
// (patientAge is typed as unknown pre-parse, number post-parse); react-hook-form
// needs both to type the form correctly with a coercing resolver.
type CaseFormValues = z.input<typeof treatmentCaseSchema>;

export function CaseForm({
  remedyId,
  healerId,
  treatmentCase,
}: {
  remedyId: number;
  healerId: number;
  treatmentCase?: TreatmentCase;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CaseFormValues, unknown, TreatmentCaseInput>({
    resolver: zodResolver(treatmentCaseSchema),
    defaultValues: {
      patientAge: treatmentCase?.patientAge ?? 0,
      patientSex: treatmentCase?.patientSex ?? "",
      symptoms: treatmentCase?.symptoms ?? "",
      result: treatmentCase?.result ?? "",
      note: treatmentCase?.note ?? "",
      treatedOn: treatmentCase?.treatedOn ?? "",
    },
  });

  const save = useMutation({
    mutationFn: (values: TreatmentCaseInput) =>
      treatmentCase
        ? updateCase(treatmentCase.id, values)
        : createCase({ ...values, remedyId, healerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseListKey(remedyId) });
      router.push(`/staff/remedies/${remedyId}/treatment-cases`);
      router.refresh();
    },
  });

  const field = "w-full rounded border border-stone-300 p-2";

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} className="max-w-lg space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="patientSex" className="text-sm font-medium">
          Patient sex (เพศ)
        </label>
        <input id="patientSex" className={field} {...register("patientSex")} />
        {errors.patientSex ? <p className="text-sm text-red-600">{errors.patientSex.message}</p> : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="patientAge" className="text-sm font-medium">
          Patient age (อายุ)
        </label>
        <input id="patientAge" type="number" min={0} className={field} {...register("patientAge")} />
        {errors.patientAge ? <p className="text-sm text-red-600">{errors.patientAge.message}</p> : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="treatedOn" className="text-sm font-medium">
          Date treated (วันที่รักษา)
        </label>
        <input id="treatedOn" type="date" className={field} {...register("treatedOn")} />
        {errors.treatedOn ? <p className="text-sm text-red-600">{errors.treatedOn.message}</p> : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="symptoms" className="text-sm font-medium">
          Symptoms (อาการ)
        </label>
        <textarea id="symptoms" rows={2} className={field} {...register("symptoms")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="result" className="text-sm font-medium">
          Result (ผลการรักษา)
        </label>
        <textarea id="result" rows={2} className={field} {...register("result")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="note" className="text-sm font-medium">
          Note (หมายเหตุ)
        </label>
        <textarea id="note" rows={2} className={field} {...register("note")} />
      </div>
      {save.isError ? <p className="text-sm text-red-600">Could not save. Try again.</p> : null}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded bg-stone-800 px-4 py-2 text-white disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => router.push(`/staff/remedies/${remedyId}/treatment-cases`)}
          className="rounded border border-stone-300 px-4 py-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
