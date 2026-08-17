
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { PhotoInput, type PendingPhoto } from "@/components/PhotoInput";
import { PhotoManager } from "@/components/PhotoManager";
import { btnGhost, btnPrimary, staffCard, staffField, staffFieldError, staffLabel } from "@/components/staff-ui";
import type { District } from "@/lib/api-types";
import { districtSchema, type DistrictInput } from "@/lib/district-schema";
import { useT } from "@/lib/i18n/useT";
import { createDistrict, districtListKey, updateDistrict, uploadPhoto } from "@/lib/staff-queries";

export function DistrictForm({
  provinceId,
  district,
}: {
  provinceId: number;
  district?: District;
}) {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const back = `/staff/provinces/${provinceId}`;
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
      navigate(back);
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
          <button type="button" onClick={() => navigate(back)} className={btnGhost}>
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
