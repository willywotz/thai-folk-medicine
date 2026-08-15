"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { EntityCombobox } from "@/components/EntityCombobox";
import { HerbPicker } from "@/components/HerbPicker";
import { PhotoManager } from "@/components/PhotoManager";
import { btnGhost, btnPrimary, staffCard, staffField, staffFieldError, staffLabel } from "@/components/staff-ui";
import type { Healer, Remedy } from "@/lib/api-types";
import { remedySchema, type RemedyInput } from "@/lib/remedy-schema";
import { createRemedy, remedyListKey, updateRemedy } from "@/lib/staff-queries";

export function RemedyForm({
  remedy,
  healers,
}: {
  remedy?: Remedy;
  healers: Pick<Healer, "id" | "fullName">[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [healerId, setHealerId] = useState(remedy?.healerId ?? healers[0]?.id ?? 0);
  const [herbs, setHerbs] = useState(
    remedy?.herbs?.map((h) => ({ herbId: h.herbId, amount: h.amount })) ?? [],
  );
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
    mutationFn: (values: RemedyInput) => {
      const payload = { ...values, herbs, healerId };
      return remedy ? updateRemedy(remedy.id, payload) : createRemedy(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: remedyListKey() });
      router.push("/staff/remedies");
      router.refresh();
    },
  });

  const field = staffField;

  return (
    <div className="max-w-xl space-y-6">
      <form onSubmit={handleSubmit((v) => save.mutate(v))} className={`${staffCard} space-y-4 p-6`} noValidate>
        <div className="space-y-1">
          <label htmlFor="healerId" className={staffLabel}>
            Healer (หมอพื้นบ้าน)
          </label>
          <EntityCombobox
            options={healers.map((h) => ({ value: h.id, label: h.fullName }))}
            value={healerId}
            onChange={setHealerId}
            placeholder="ค้นหาหมอ (search healer)"
            ariaLabel="healer"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="name" className={staffLabel}>
            Name (ชื่อตำรับยา)
          </label>
          <input id="name" className={field} {...register("name")} />
          {errors.name ? <p className={staffFieldError}>{errors.name.message}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor="symptoms" className={staffLabel}>
            Symptoms treated (สรรพคุณ)
          </label>
          <textarea id="symptoms" rows={2} className={field} {...register("symptoms")} />
        </div>
        <HerbPicker value={herbs} onChange={setHerbs} />
        <div className="space-y-1">
          <label htmlFor="preparationMethod" className={staffLabel}>
            Preparation (วิธีปรุง)
          </label>
          <textarea id="preparationMethod" rows={2} className={field} {...register("preparationMethod")} />
        </div>
        <div className="space-y-1">
          <label htmlFor="usage" className={staffLabel}>
            Usage (วิธีใช้)
          </label>
          <textarea id="usage" rows={2} className={field} {...register("usage")} />
        </div>
        <div className="space-y-1">
          <label htmlFor="note" className={staffLabel}>
            Note (หมายเหตุ)
          </label>
          <textarea id="note" rows={2} className={field} {...register("note")} />
        </div>
        {save.isError ? <p className={staffFieldError}>Could not save. Try again.</p> : null}
        <div className="flex gap-3">
          <button type="submit" disabled={save.isPending} className={btnPrimary}>
            Save
          </button>
          <button type="button" onClick={() => router.push("/staff/remedies")} className={btnGhost}>
            Cancel
          </button>
        </div>
      </form>
      {remedy ? (
        <div className={`${staffCard} p-6`}>
          <PhotoManager ownerType="remedy" ownerId={remedy.id} />
        </div>
      ) : null}
    </div>
  );
}
