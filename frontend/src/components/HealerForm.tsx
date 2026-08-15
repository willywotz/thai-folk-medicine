"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { PhotoManager } from "@/components/PhotoManager";
import { btnGhost, btnPrimary, staffCard, staffField, staffFieldError, staffLabel } from "@/components/staff-ui";
import type { District, Healer } from "@/lib/api-types";
import { healerSchema, type HealerInput } from "@/lib/healer-schema";
import { createHealer, healerListKey, updateHealer } from "@/lib/staff-queries";

export function HealerForm({ healer, districts }: { healer?: Healer; districts: District[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [districtId, setDistrictId] = useState(healer?.districtId ?? districts[0]?.id ?? 0);
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
            District (อำเภอ)
          </label>
          <select
            id="districtId"
            required
            className={field}
            value={districtId}
            onChange={(e) => setDistrictId(Number(e.target.value))}
          >
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nameEnglish} · {d.nameThai}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="fullName" className={staffLabel}>
            Full name (ชื่อ)
          </label>
          <input id="fullName" className={field} {...register("fullName")} />
          {errors.fullName ? <p className={staffFieldError}>{errors.fullName.message}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor="subDistrict" className={staffLabel}>
            Sub-district (ตำบล/หมู่บ้าน)
          </label>
          <input id="subDistrict" className={field} {...register("subDistrict")} />
        </div>
        <div className="space-y-1">
          <label htmlFor="specialty" className={staffLabel}>
            Specialty (ความชำนาญ)
          </label>
          <input id="specialty" className={field} {...register("specialty")} />
        </div>
        <div className="space-y-1">
          <label htmlFor="biography" className={staffLabel}>
            Biography (ประวัติ)
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
      {healer ? (
        <div className={`${staffCard} p-6`}>
          <PhotoManager ownerType="healer" ownerId={healer.id} />
        </div>
      ) : null}
    </div>
  );
}
