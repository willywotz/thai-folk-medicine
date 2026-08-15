"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { btnGhost, btnPrimary, staffCard, staffField, staffFieldError, staffLabel } from "@/components/staff-ui";
import type { District } from "@/lib/api-types";
import { districtSchema, type DistrictInput } from "@/lib/district-schema";
import { createDistrict, districtListKey, updateDistrict } from "@/lib/staff-queries";

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
  const queryClient = useQueryClient();
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
    mutationFn: (values: DistrictInput) =>
      district ? updateDistrict(district.id, values) : createDistrict({ ...values, provinceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: districtListKey(provinceId) });
      onDone();
    },
  });

  const field = staffField;

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} className={`${staffCard} max-w-xl space-y-4 p-6`} noValidate>
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
      {save.isError ? <p className={staffFieldError}>Could not save. Try again.</p> : null}
      <div className="flex gap-3">
        <button type="submit" disabled={save.isPending} className={btnPrimary}>
          Save
        </button>
        <button type="button" onClick={onDone} className={btnGhost}>
          Cancel
        </button>
      </div>
    </form>
  );
}
