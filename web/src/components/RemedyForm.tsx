
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { EntityCombobox } from "@/components/EntityCombobox";
import { HerbPicker } from "@/components/HerbPicker";
import { PhotoInput, type PendingPhoto } from "@/components/PhotoInput";
import { PhotoManager } from "@/components/PhotoManager";
import { btnGhost, btnPrimary, staffCard, staffField, staffFieldError, staffLabel } from "@/components/staff-ui";
import type { Remedy } from "@/lib/api-types";
import { useT } from "@/lib/i18n/useT";
import { remedySchema, type RemedyInput } from "@/lib/remedy-schema";
import { createRemedy, remedyListKey, updateRemedy, uploadPhoto } from "@/lib/staff-queries";

export function RemedyForm({
  remedy,
  healerOptions,
  defaultHealerId,
}: {
  remedy?: Remedy;
  healerOptions: { value: number; label: string }[];
  defaultHealerId?: number;
}) {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [healerId, setHealerId] = useState(
    remedy?.healerId ?? defaultHealerId ?? healerOptions[0]?.value ?? 0,
  );
  const [herbs, setHerbs] = useState(
    remedy?.herbs?.map((h) => ({ herbId: h.herbId, amount: h.amount })) ?? [],
  );
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RemedyInput>({
    resolver: zodResolver(remedySchema),
    defaultValues: {
      name: remedy?.name ?? "",
      symptoms: remedy?.symptoms ?? "",
      preparationMethod: remedy?.preparationMethod ?? "",
      usage: remedy?.usage ?? "",
      note: remedy?.note ?? "",
      herbs: [],
    },
  });

  const save = useMutation({
    mutationFn: async (values: RemedyInput) => {
      const payload = { ...values, herbs, healerId };
      if (remedy) return updateRemedy(remedy.id, payload);
      const created = await createRemedy(payload);
      await Promise.all(
        pendingPhotos.map((p) =>
          uploadPhoto({ ownerType: "remedy", ownerId: created.id, file: p.file, caption: p.caption }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: remedyListKey() });
      navigate("/staff/remedies");
},
  });

  const field = staffField;

  return (
    <div className="max-w-xl space-y-6">
      <form onSubmit={handleSubmit((v) => save.mutate(v))} className={`${staffCard} space-y-4 p-6`} noValidate>
        <div className="space-y-1">
          <label htmlFor="healerId" className={staffLabel}>
            {t.staff.form.healer}
          </label>
          <EntityCombobox
            options={healerOptions}
            value={healerId}
            onChange={setHealerId}
            placeholder={t.staff.form.searchHealer}
            ariaLabel="healer"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="name" className={staffLabel}>
            {t.staff.form.remedyName}
          </label>
          <input id="name" className={field} {...register("name")} />
          {errors.name ? <p className={staffFieldError}>{errors.name.message}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor="symptoms" className={staffLabel}>
            {t.staff.form.symptomsTreated}
          </label>
          <textarea id="symptoms" rows={2} className={field} {...register("symptoms")} />
        </div>
        <HerbPicker value={herbs} onChange={setHerbs} />
        <div className="space-y-1">
          <label htmlFor="preparationMethod" className={staffLabel}>
            {t.staff.form.preparation}
          </label>
          <textarea id="preparationMethod" rows={2} className={field} {...register("preparationMethod")} />
        </div>
        <div className="space-y-1">
          <label htmlFor="usage" className={staffLabel}>
            {t.staff.form.usage}
          </label>
          <textarea id="usage" rows={2} className={field} {...register("usage")} />
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
          <button type="button" onClick={() => navigate("/staff/remedies")} className={btnGhost}>
            {t.staff.cancel}
          </button>
        </div>
      </form>
      <div className={`${staffCard} p-6`}>
        {remedy ? (
          <PhotoManager ownerType="remedy" ownerId={remedy.id} />
        ) : (
          <PhotoInput value={pendingPhotos} onChange={setPendingPhotos} />
        )}
      </div>
    </div>
  );
}
