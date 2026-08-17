import { z } from "zod";

export const treatmentCaseSchema = z.object({
  patientAge: z.coerce.number().int().min(0, "Age must be 0 or more"),
  patientSex: z.string().min(1, "Patient sex is required"),
  symptoms: z.string(),
  result: z.string(),
  note: z.string(),
  treatedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
});

export type TreatmentCaseInput = z.infer<typeof treatmentCaseSchema>;
