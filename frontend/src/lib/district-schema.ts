import { z } from "zod";

export const districtSchema = z.object({
  nameThai: z.string().min(1, "Thai name is required"),
  nameEnglish: z.string(),
});

export type DistrictInput = z.infer<typeof districtSchema>;
