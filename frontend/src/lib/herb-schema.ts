import { z } from "zod";

export const herbSchema = z.object({
  nameThai: z.string().min(1, "Thai name is required"),
  nameEnglish: z.string(),
  scientificName: z.string(),
  properties: z.string(),
  description: z.string(),
});

export type HerbInput = z.infer<typeof herbSchema>;
