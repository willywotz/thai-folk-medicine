import { it, expect } from "vitest";
import { patientSexLabel } from "./format";

it("maps patient sex codes to labels", () => {
  expect(patientSexLabel("male")).toBe("Male");
  expect(patientSexLabel("female")).toBe("Female");
  expect(patientSexLabel("male")).not.toEqual(patientSexLabel("female"));
});
