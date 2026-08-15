"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { EntityCombobox } from "@/components/EntityCombobox";
import { PhotoInput, type PendingPhoto } from "@/components/PhotoInput";
import { PhotoManager } from "@/components/PhotoManager";
import { btnGhost, btnPrimary, staffCard, staffField, staffFieldError, staffLabel } from "@/components/staff-ui";
import type { Healer } from "@/lib/api-types";
import { healerSchema, type HealerInput } from "@/lib/healer-schema";
import { useT } from "@/lib/i18n/useT";
import { createHealer, healerListKey, updateHealer, uploadPhoto } from "@/lib/staff-queries";

export function HealerForm({
  healer,
  districtOptions,
}: {
  healer?: Healer;
  districtOptions: { value: number; label: string }[];
}) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [districtId, setDistrictId] = useState(healer?.districtId ?? districtOptions[0]?.value ?? 0);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<HealerInput>({
    resolver: zodResolver(healerSchema),
    defaultValues: {
      fullName: healer?.fullName ?? "",
      subDistrict: healer?.subDistrict ?? "",
      specialty: healer?.specialty ?? "",
      biography: healer?.biography ?? "",
    },
  });

  const save = useMutation({
    mutationFn: async (values: HealerInput) => {
      if (healer) return updateHealer(healer.id, { ...values, districtId });
      const created = await createHealer({ ...values, districtId });
      await Promise.all(
        pendingPhotos.map((p) =>
          uploadPhoto({ ownerType: "healer", ownerId: created.id, file: p.file, caption: p.caption }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healerListKey() });
      router.push("/staff/healers");
      router.refresh();
    },
  });

  const field = staffField;

  return (
    <div className="max-w-xl space-y-6">
      <form onSubmit={handleSubmit((v) => save.mutate(v))} className={`${staffCard} space-y-4 p-6`} noValidate>
        <div className="space-y-1">
          <label htmlFor="districtId" className={staffLabel}>
            {t.staff.form.district}
          </label>
          <EntityCombobox
            options={districtOptions}
            value={districtId}
            onChange={setDistrictId}
            placeholder={t.staff.form.searchDistrict}
            ariaLabel="district"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="fullName" className={staffLabel}>
            {t.staff.form.fullName}
          </label>
          <input id="fullName" className={field} {...register("fullName")} />
          {errors.fullName ? <p className={staffFieldError}>{errors.fullName.message}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor="subDistrict" className={staffLabel}>
            {t.staff.form.subDistrict}
          </label>
          <input id="subDistrict" className={field} {...register("subDistrict")} />
        </div>
        <div className="space-y-1">
          <label htmlFor="specialty" className={staffLabel}>
            {t.staff.form.specialty}
          </label>
          <input id="specialty" className={field} {...register("specialty")} />
        </div>
        <div className="space-y-1">
          <label htmlFor="biography" className={staffLabel}>
            {t.staff.form.biography}
          </label>
          <textarea id="biography" rows={4} className={field} {...register("biography")} />
        </div>
        {save.isError ? <p className={staffFieldError}>Could not save. Try again.</p> : null}
        <div className="flex gap-3">
          <button type="submit" disabled={save.isPending} className={btnPrimary}>
            Save
          </button>
          <button type="button" onClick={() => router.push("/staff/healers")} className={btnGhost}>
            Cancel
          </button>
        </div>
      </form>
      <div className={`${staffCard} p-6`}>
        {healer ? (
          <PhotoManager ownerType="healer" ownerId={healer.id} />
        ) : (
          <PhotoInput value={pendingPhotos} onChange={setPendingPhotos} />
        )}
      </div>
    </div>
  );
}
