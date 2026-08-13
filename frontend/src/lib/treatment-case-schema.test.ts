import { describe, expect, it } from "vitest";

import { treatmentCaseSchema } from "./treatment-case-schema";

const base = { patientAge: 40, patientSex: "female", symptoms: "", result: "", note: "", treatedOn: "2026-03-01" };

describe("treatmentCaseSchema", () => {
  it("accepts a valid case", () => {
    expect(treatmentCaseSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an empty patientSex", () => {
    expect(treatmentCaseSchema.safeParse({ ...base, patientSex: "" }).success).toBe(false);
  });

  it("rejects a negative age", () => {
    expect(treatmentCaseSchema.safeParse({ ...base, patientAge: -1 }).success).toBe(false);
  });

  it("rejects a missing date", () => {
    expect(treatmentCaseSchema.safeParse({ ...base, treatedOn: "" }).success).toBe(false);
  });

  it("coerces a numeric-string age", () => {
    const parsed = treatmentCaseSchema.safeParse({ ...base, patientAge: "50" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.patientAge).toBe(50);
  });
});
