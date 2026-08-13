"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import type { Remedy } from "@/lib/api-types";
import { remedySchema, type RemedyInput } from "@/lib/remedy-schema";
import { createRemedy, remedyListKey, updateRemedy } from "@/lib/staff-queries";

export function RemedyForm({ healerId, remedy }: { healerId: number; remedy?: Remedy }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RemedyInput>({
    resolver: zodResolver(remedySchema),
    defaultValues: {
      name: remedy?.name ?? "",
      symptoms: remedy?.symptoms ?? "",
      ingredients: remedy?.ingredients ?? "",
      preparationMethod: remedy?.preparationMethod ?? "",
      usage: remedy?.usage ?? "",
      note: remedy?.note ?? "",
    },
  });

  const save = useMutation({
    mutationFn: (values: RemedyInput) =>
      remedy ? updateRemedy(remedy.id, values) : createRemedy({ ...values, healerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: remedyListKey(healerId) });
      router.push(`/staff/healers/${healerId}/remedies`);
      router.refresh();
    },
  });

  const field = "w-full rounded border border-stone-300 p-2";

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} className="max-w-lg space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">
          Name (ชื่อตำรับยา)
        </label>
        <input id="name" className={field} {...register("name")} />
        {errors.name ? <p className="text-sm text-red-600">{errors.name.message}</p> : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="symptoms" className="text-sm font-medium">
          Symptoms treated (สรรพคุณ)
        </label>
        <textarea id="symptoms" rows={2} className={field} {...register("symptoms")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="ingredients" className="text-sm font-medium">
          Ingredients (ตัวยา)
        </label>
        <textarea id="ingredients" rows={2} className={field} {...register("ingredients")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="preparationMethod" className="text-sm font-medium">
          Preparation (วิธีปรุง)
        </label>
        <textarea id="preparationMethod" rows={2} className={field} {...register("preparationMethod")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="usage" className="text-sm font-medium">
          Usage (วิธีใช้)
        </label>
        <textarea id="usage" rows={2} className={field} {...register("usage")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="note" className="text-sm font-medium">
          Note (หมายเหตุ)
        </label>
        <textarea id="note" rows={2} className={field} {...register("note")} />
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
          onClick={() => router.push(`/staff/healers/${healerId}/remedies`)}
          className="rounded border border-stone-300 px-4 py-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
