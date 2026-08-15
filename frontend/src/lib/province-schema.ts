import { z } from "zod";

export const provinceSchema = z.object({
  nameThai: z.string().min(1, "Thai name is required"),
  nameEnglish: z.string(),
});

export type ProvinceInput = z.infer<typeof provinceSchema>;
