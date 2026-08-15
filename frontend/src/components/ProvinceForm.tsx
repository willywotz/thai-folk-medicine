"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { btnGhost, btnPrimary, staffCard, staffField, staffFieldError, staffLabel } from "@/components/staff-ui";
import type { Province } from "@/lib/api-types";
import { provinceSchema, type ProvinceInput } from "@/lib/province-schema";
import { createProvince, provinceListKey, updateProvince } from "@/lib/staff-queries";

export function ProvinceForm({ province }: { province?: Province }) {
  const router = useRouter();
  const queryClient = useQueryClient();
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
    mutationFn: (values: ProvinceInput) =>
      province ? updateProvince(province.id, values) : createProvince(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: provinceListKey });
      router.push("/staff/provinces");
      router.refresh();
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
        <button type="button" onClick={() => router.push("/staff/provinces")} className={btnGhost}>
          Cancel
        </button>
      </div>
    </form>
  );
}
