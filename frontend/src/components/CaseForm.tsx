"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { btnGhost, btnPrimary, staffCard, staffField, staffFieldError, staffLabel } from "@/components/staff-ui";
import type { TreatmentCase } from "@/lib/api-types";
import { caseListKey, createCase, updateCase } from "@/lib/staff-queries";
import { treatmentCaseSchema, type TreatmentCaseInput } from "@/lib/treatment-case-schema";

// z.coerce.number() makes the schema's input type diverge from its output type
// (patientAge is typed as unknown pre-parse, number post-parse); react-hook-form
// needs both to type the form correctly with a coercing resolver.
type CaseFormValues = z.input<typeof treatmentCaseSchema>;

export function CaseForm({
  treatmentCase,
  remedies,
}: {
  treatmentCase?: TreatmentCase;
  remedies: { id: number; name: string; healerId: number }[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [remedyId, setRemedyId] = useState(treatmentCase?.remedyId ?? remedies[0]?.id ?? 0);
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
    mutationFn: (values: TreatmentCaseInput) => {
      const healerId = remedies.find((r) => r.id === remedyId)?.healerId ?? 0;
      const payload = { ...values, remedyId, healerId };
      return treatmentCase ? updateCase(treatmentCase.id, payload) : createCase(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseListKey() });
      router.push("/staff/cases");
      router.refresh();
    },
  });

  const field = staffField;

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} className={`${staffCard} max-w-xl space-y-4 p-6`} noValidate>
      <div className="space-y-1">
        <label htmlFor="remedyId" className={staffLabel}>
          Remedy (ตำรับยา)
        </label>
        <select
          id="remedyId"
          required
          className={field}
          value={remedyId}
          onChange={(e) => setRemedyId(Number(e.target.value))}
        >
          {remedies.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="patientSex" className={staffLabel}>
          Patient sex (เพศ)
        </label>
        <input id="patientSex" className={field} {...register("patientSex")} />
        {errors.patientSex ? <p className={staffFieldError}>{errors.patientSex.message}</p> : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="patientAge" className={staffLabel}>
          Patient age (อายุ)
        </label>
        <input id="patientAge" type="number" min={0} className={field} {...register("patientAge")} />
        {errors.patientAge ? <p className={staffFieldError}>{errors.patientAge.message}</p> : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="treatedOn" className={staffLabel}>
          Date treated (วันที่รักษา)
        </label>
        <input id="treatedOn" type="date" className={field} {...register("treatedOn")} />
        {errors.treatedOn ? <p className={staffFieldError}>{errors.treatedOn.message}</p> : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="symptoms" className={staffLabel}>
          Symptoms (อาการ)
        </label>
        <textarea id="symptoms" rows={2} className={field} {...register("symptoms")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="result" className={staffLabel}>
          Result (ผลการรักษา)
        </label>
        <textarea id="result" rows={2} className={field} {...register("result")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="note" className={staffLabel}>
          Note (หมายเหตุ)
        </label>
        <textarea id="note" rows={2} className={field} {...register("note")} />
      </div>
      {save.isError ? <p className={staffFieldError}>Could not save. Try again.</p> : null}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={save.isPending}
          className={btnPrimary}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => router.push("/staff/cases")}
          className={btnGhost}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
