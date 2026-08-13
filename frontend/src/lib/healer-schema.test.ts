import { describe, expect, it } from "vitest";

import { healerSchema } from "./healer-schema";

describe("healerSchema", () => {
  it("requires a full name", () => {
    expect(healerSchema.safeParse({ fullName: "", subDistrict: "", specialty: "", biography: "" }).success).toBe(false);
  });

  it("accepts a minimal healer", () => {
    const parsed = healerSchema.safeParse({ fullName: "หมอ ก", subDistrict: "", specialty: "", biography: "" });
    expect(parsed.success).toBe(true);
  });
});
