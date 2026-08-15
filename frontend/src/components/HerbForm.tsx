"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { PhotoInput, type PendingPhoto } from "@/components/PhotoInput";
import { PhotoManager } from "@/components/PhotoManager";
import { btnGhost, btnPrimary, staffCard, staffField, staffFieldError, staffLabel } from "@/components/staff-ui";
import type { Herb } from "@/lib/api-types";
import { herbSchema, type HerbInput } from "@/lib/herb-schema";
import { createHerb, herbListKey, updateHerb, uploadPhoto } from "@/lib/staff-queries";

export function HerbForm({ herb }: { herb?: Herb }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<HerbInput>({
    resolver: zodResolver(herbSchema),
    defaultValues: {
      nameThai: herb?.nameThai ?? "",
      nameEnglish: herb?.nameEnglish ?? "",
      scientificName: herb?.scientificName ?? "",
      properties: herb?.properties ?? "",
      description: herb?.description ?? "",
    },
  });

  const save = useMutation({
    mutationFn: async (values: HerbInput) => {
      if (herb) return updateHerb(herb.id, values);
      const created = await createHerb(values);
      await Promise.all(
        pendingPhotos.map((p) =>
          uploadPhoto({ ownerType: "herb", ownerId: created.id, file: p.file, caption: p.caption }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: herbListKey() });
      router.push("/staff/herbs");
      router.refresh();
    },
  });

  const field = staffField;

  return (
    <div className="max-w-xl space-y-6">
      <form onSubmit={handleSubmit((v) => save.mutate(v))} className={`${staffCard} space-y-4 p-6`} noValidate>
        <div className="space-y-1">
          <label htmlFor="nameThai" className={staffLabel}>
            ชื่อไทย (Thai name)
          </label>
          <input id="nameThai" className={field} {...register("nameThai")} />
          {errors.nameThai ? <p className={staffFieldError}>{errors.nameThai.message}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor="nameEnglish" className={staffLabel}>
            English name
          </label>
          <input id="nameEnglish" className={field} {...register("nameEnglish")} />
        </div>
        <div className="space-y-1">
          <label htmlFor="scientificName" className={staffLabel}>
            ชื่อวิทยาศาสตร์ (Scientific name)
          </label>
          <input id="scientificName" className={field} {...register("scientificName")} />
        </div>
        <div className="space-y-1">
          <label htmlFor="properties" className={staffLabel}>
            สรรพคุณ (Properties)
          </label>
          <textarea id="properties" rows={3} className={field} {...register("properties")} />
        </div>
        <div className="space-y-1">
          <label htmlFor="description" className={staffLabel}>
            รายละเอียด (Description)
          </label>
          <textarea id="description" rows={3} className={field} {...register("description")} />
        </div>
        {save.isError ? <p className={staffFieldError}>Could not save. Try again.</p> : null}
        <div className="flex gap-3">
          <button type="submit" disabled={save.isPending} className={btnPrimary}>
            Save
          </button>
          <button type="button" onClick={() => router.push("/staff/herbs")} className={btnGhost}>
            Cancel
          </button>
        </div>
      </form>
      <div className={`${staffCard} p-6`}>
        {herb ? (
          <PhotoManager ownerType="herb" ownerId={herb.id} />
        ) : (
          <PhotoInput value={pendingPhotos} onChange={setPendingPhotos} />
        )}
      </div>
    </div>
  );
}
