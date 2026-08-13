import { z } from "zod";

export const healerSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  subDistrict: z.string(),
  specialty: z.string(),
  biography: z.string(),
});

export type HealerInput = z.infer<typeof healerSchema>;
