import { z } from "zod";

export const remedySchema = z.object({
  name: z.string().min(1, "Name is required"),
  symptoms: z.string(),
  ingredients: z.string(),
  preparationMethod: z.string(),
  usage: z.string(),
  note: z.string(),
});

export type RemedyInput = z.infer<typeof remedySchema>;
