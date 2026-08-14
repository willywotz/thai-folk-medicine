"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import type { Herb } from "@/lib/api-types";
import { herbSchema, type HerbInput } from "@/lib/herb-schema";
import { createHerb, herbListKey, updateHerb } from "@/lib/staff-queries";

export function HerbForm({ herb }: { herb?: Herb }) {
  const router = useRouter();
  const queryClient = useQueryClient();
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
    mutationFn: (values: HerbInput) => (herb ? updateHerb(herb.id, values) : createHerb(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: herbListKey });
      router.push("/staff/herbs");
      router.refresh();
    },
  });

  const field = "w-full rounded border border-stone-300 p-2";

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} className="max-w-lg space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="nameThai" className="text-sm font-medium">
          ชื่อไทย (Thai name)
        </label>
        <input id="nameThai" className={field} {...register("nameThai")} />
        {errors.nameThai ? <p className="text-sm text-red-600">{errors.nameThai.message}</p> : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="nameEnglish" className="text-sm font-medium">
          English name
        </label>
        <input id="nameEnglish" className={field} {...register("nameEnglish")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="scientificName" className="text-sm font-medium">
          ชื่อวิทยาศาสตร์ (Scientific name)
        </label>
        <input id="scientificName" className={field} {...register("scientificName")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="properties" className="text-sm font-medium">
          สรรพคุณ (Properties)
        </label>
        <textarea id="properties" rows={3} className={field} {...register("properties")} />
      </div>
      <div className="space-y-1">
        <label htmlFor="description" className="text-sm font-medium">
          รายละเอียด (Description)
        </label>
        <textarea id="description" rows={3} className={field} {...register("description")} />
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
          onClick={() => router.push("/staff/herbs")}
          className="rounded border border-stone-300 px-4 py-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
