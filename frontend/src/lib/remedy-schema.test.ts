import { describe, expect, it } from "vitest";

import { remedySchema } from "./remedy-schema";

describe("remedySchema", () => {
  it("requires a name", () => {
    expect(
      remedySchema.safeParse({ name: "", symptoms: "", ingredients: "", preparationMethod: "", usage: "", note: "" })
        .success,
    ).toBe(false);
  });

  it("accepts a minimal remedy", () => {
    expect(
      remedySchema.safeParse({ name: "ยาต้ม", symptoms: "", ingredients: "", preparationMethod: "", usage: "", note: "" })
        .success,
    ).toBe(true);
  });
});
