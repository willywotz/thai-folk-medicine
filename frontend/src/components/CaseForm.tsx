"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { EntityCombobox } from "@/components/EntityCombobox";
import { PhotoInput, type PendingPhoto } from "@/components/PhotoInput";
import { PhotoManager } from "@/components/PhotoManager";
import { btnGhost, btnPrimary, staffCard, staffField, staffFieldError, staffLabel } from "@/components/staff-ui";
import type { TreatmentCase } from "@/lib/api-types";
import { useT } from "@/lib/i18n/useT";
import { caseListKey, createCase, updateCase, uploadPhoto } from "@/lib/staff-queries";
import { treatmentCaseSchema, type TreatmentCaseInput } from "@/lib/treatment-case-schema";

// z.coerce.number() makes the schema's input type diverge from its output type
// (patientAge is typed as unknown pre-parse, number post-parse); react-hook-form
// needs both to type the form correctly with a coercing resolver.
type CaseFormValues = z.input<typeof treatmentCaseSchema>;

export function CaseForm({
  treatmentCase,
  remedyOptions,
  defaultRemedyId,
}: {
  treatmentCase?: TreatmentCase;
  remedyOptions: { value: number; label: string; healerId: number }[];
  defaultRemedyId?: number;
}) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [remedyId, setRemedyId] = useState(
    treatmentCase?.remedyId ?? defaultRemedyId ?? remedyOptions[0]?.value ?? 0,
  );
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
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
    mutationFn: async (values: TreatmentCaseInput) => {
      const healerId = remedyOptions.find((r) => r.value === remedyId)?.healerId ?? 0;
      const payload = { ...values, remedyId, healerId };
      if (treatmentCase) return updateCase(treatmentCase.id, payload);
      const created = await createCase(payload);
      await Promise.all(
        pendingPhotos.map((p) =>
          uploadPhoto({ ownerType: "case", ownerId: created.id, file: p.file, caption: p.caption }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseListKey() });
      router.push("/staff/cases");
      router.refresh();
    },
  });

  const field = staffField;

  return (
    <div className="max-w-xl space-y-6">
      <form onSubmit={handleSubmit((v) => save.mutate(v))} className={`${staffCard} space-y-4 p-6`} noValidate>
        <div className="space-y-1">
          <label htmlFor="remedyId" className={staffLabel}>
            {t.staff.form.remedy}
          </label>
          <EntityCombobox
            options={remedyOptions}
            value={remedyId}
            onChange={setRemedyId}
            placeholder={t.staff.form.searchRemedy}
            ariaLabel="remedy"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="patientSex" className={staffLabel}>
            {t.staff.form.patientSex}
          </label>
          <input id="patientSex" className={field} {...register("patientSex")} />
          {errors.patientSex ? <p className={staffFieldError}>{errors.patientSex.message}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor="patientAge" className={staffLabel}>
            {t.staff.form.patientAge}
          </label>
          <input id="patientAge" type="number" min={0} className={field} {...register("patientAge")} />
          {errors.patientAge ? <p className={staffFieldError}>{errors.patientAge.message}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor="treatedOn" className={staffLabel}>
            {t.staff.form.dateTreated}
          </label>
          <input id="treatedOn" type="date" className={field} {...register("treatedOn")} />
          {errors.treatedOn ? <p className={staffFieldError}>{errors.treatedOn.message}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor="symptoms" className={staffLabel}>
            {t.staff.form.symptoms}
          </label>
          <textarea id="symptoms" rows={2} className={field} {...register("symptoms")} />
        </div>
        <div className="space-y-1">
          <label htmlFor="result" className={staffLabel}>
            {t.staff.form.result}
          </label>
          <textarea id="result" rows={2} className={field} {...register("result")} />
        </div>
        <div className="space-y-1">
          <label htmlFor="note" className={staffLabel}>
            {t.staff.form.note}
          </label>
          <textarea id="note" rows={2} className={field} {...register("note")} />
        </div>
        {save.isError ? <p className={staffFieldError}>{t.staff.errorSave}</p> : null}
        <div className="flex gap-3">
          <button type="submit" disabled={save.isPending} className={btnPrimary}>
            {t.staff.save}
          </button>
          <button type="button" onClick={() => router.push("/staff/cases")} className={btnGhost}>
            {t.staff.cancel}
          </button>
        </div>
      </form>
      <div className={`${staffCard} p-6`}>
        {treatmentCase ? (
          <PhotoManager ownerType="case" ownerId={treatmentCase.id} />
        ) : (
          <PhotoInput value={pendingPhotos} onChange={setPendingPhotos} />
        )}
      </div>
    </div>
  );
}
