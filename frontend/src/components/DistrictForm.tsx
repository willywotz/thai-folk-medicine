"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { PhotoInput, type PendingPhoto } from "@/components/PhotoInput";
import { PhotoManager } from "@/components/PhotoManager";
import { btnGhost, btnPrimary, staffCard, staffField, staffFieldError, staffLabel } from "@/components/staff-ui";
import type { District } from "@/lib/api-types";
import { districtSchema, type DistrictInput } from "@/lib/district-schema";
import { useT } from "@/lib/i18n/useT";
import { createDistrict, districtListKey, updateDistrict, uploadPhoto } from "@/lib/staff-queries";

// Districts are managed inline on the province detail page (no dedicated
// route), so this form reports back through onDone instead of navigating.
export function DistrictForm({
  provinceId,
  district,
  onDone,
}: {
  provinceId: number;
  district?: District;
  onDone: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DistrictInput>({
    resolver: zodResolver(districtSchema),
    defaultValues: {
      nameThai: district?.nameThai ?? "",
      nameEnglish: district?.nameEnglish ?? "",
    },
  });

  const save = useMutation({
    mutationFn: async (values: DistrictInput) => {
      if (district) return updateDistrict(district.id, values);
      const created = await createDistrict({ ...values, provinceId });
      await Promise.all(
        pendingPhotos.map((p) =>
          uploadPhoto({ ownerType: "district", ownerId: created.id, file: p.file, caption: p.caption }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: districtListKey(provinceId) });
      onDone();
    },
  });

  const field = staffField;

  return (
    <div className="max-w-xl space-y-6">
      <form onSubmit={handleSubmit((v) => save.mutate(v))} className={`${staffCard} space-y-4 p-6`} noValidate>
        <div className="space-y-1">
          <label htmlFor="nameThai" className={staffLabel}>
            {t.staff.form.thaiName}
          </label>
          <input id="nameThai" className={field} {...register("nameThai")} />
          {errors.nameThai ? <p className={staffFieldError}>{errors.nameThai.message}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor="nameEnglish" className={staffLabel}>
            {t.staff.englishName}
          </label>
          <input id="nameEnglish" className={field} {...register("nameEnglish")} />
        </div>
        {save.isError ? <p className={staffFieldError}>{t.staff.errorSave}</p> : null}
        <div className="flex gap-3">
          <button type="submit" disabled={save.isPending} className={btnPrimary}>
            {t.staff.save}
          </button>
          <button type="button" onClick={onDone} className={btnGhost}>
            {t.staff.cancel}
          </button>
        </div>
      </form>
      <div className={`${staffCard} p-6`}>
        {district ? (
          <PhotoManager ownerType="district" ownerId={district.id} />
        ) : (
          <PhotoInput value={pendingPhotos} onChange={setPendingPhotos} />
        )}
      </div>
    </div>
  );
}
