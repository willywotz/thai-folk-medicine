"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { PhotoInput, type PendingPhoto } from "@/components/PhotoInput";
import { PhotoManager } from "@/components/PhotoManager";
import { btnGhost, btnPrimary, staffCard, staffField, staffFieldError, staffLabel } from "@/components/staff-ui";
import type { Province } from "@/lib/api-types";
import { useT } from "@/lib/i18n/useT";
import { provinceSchema, type ProvinceInput } from "@/lib/province-schema";
import { createProvince, provinceListKey, updateProvince, uploadPhoto } from "@/lib/staff-queries";

export function ProvinceForm({ province }: { province?: Province }) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProvinceInput>({
    resolver: zodResolver(provinceSchema),
    defaultValues: {
      nameThai: province?.nameThai ?? "",
      nameEnglish: province?.nameEnglish ?? "",
    },
  });

  const save = useMutation({
    mutationFn: async (values: ProvinceInput) => {
      if (province) return updateProvince(province.id, values);
      const created = await createProvince(values);
      await Promise.all(
        pendingPhotos.map((p) =>
          uploadPhoto({ ownerType: "province", ownerId: created.id, file: p.file, caption: p.caption }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: provinceListKey });
      router.push("/staff/provinces");
      router.refresh();
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
          <button type="button" onClick={() => router.push("/staff/provinces")} className={btnGhost}>
            {t.staff.cancel}
          </button>
        </div>
      </form>
      <div className={`${staffCard} p-6`}>
        {province ? (
          <PhotoManager ownerType="province" ownerId={province.id} />
        ) : (
          <PhotoInput value={pendingPhotos} onChange={setPendingPhotos} />
        )}
      </div>
    </div>
  );
}
