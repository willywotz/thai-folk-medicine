import { describe, expect, it } from "vitest";

import { formatThaiDate, patientSexLabel } from "./format";

describe("formatThaiDate", () => {
  it("formats an ISO date to a readable day", () => {
    expect(formatThaiDate("2026-03-01")).toBe("1 March 2026");
  });

  it("returns an em dash for an empty value", () => {
    expect(formatThaiDate("")).toBe("—");
  });
});

describe("patientSexLabel", () => {
  it("maps known values", () => {
    expect(patientSexLabel("female")).toBe("Female");
    expect(patientSexLabel("male")).toBe("Male");
  });

  it("passes through an unknown value", () => {
    expect(patientSexLabel("other")).toBe("other");
  });
});
