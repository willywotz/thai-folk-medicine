"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import type { Healer } from "@/lib/api-types";
import { healerSchema, type HealerInput } from "@/lib/healer-schema";
import { createHealer, healerListKey, updateHealer } from "@/lib/staff-queries";

export function HealerForm({ districtId, healer }: { districtId: number; healer?: Healer }) {
  const router = useRouter();
  const queryClient = useQueryClient();
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
    mutationFn: (values: HealerInput) =>
      healer
        ? updateHealer(healer.id, { ...values, districtId })
        : createHealer({ ...values, districtId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healerListKey(districtId) });
      router.push(`/staff/districts/${districtId}`);
      router.refresh();
    },
  });

  const field = "w-full rounded border border-stone-300 p-2";

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} className="max-w-lg space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="fullName" className="text-sm font-medium">
          Full name (ชื่อ)
        </label>
        <input id="fullName" className={field} {...register("fullName")} />
        {errors.fullName ? <p className="text-sm text-red-600">{errors.fullName.message}</p> : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="subDistrict" className="text-sm font-medium">
          Sub-district (ตำบล/หมู่บ้าน)
        </label>
        <input id="subDistrict" className={field} {...register("subDistrict")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="specialty" className="text-sm font-medium">
          Specialty (ความชำนาญ)
        </label>
        <input id="specialty" className={field} {...register("specialty")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="biography" className="text-sm font-medium">
          Biography (ประวัติ)
        </label>
        <textarea id="biography" rows={4} className={field} {...register("biography")} />
      </div>
      {save.isError ? <p className="text-sm text-red-600">Could not save. Try again.</p> : null}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded bg-stone-800 px-4 py-2 text-white disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => router.push(`/staff/districts/${districtId}`)}
          className="rounded border border-stone-300 px-4 py-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
