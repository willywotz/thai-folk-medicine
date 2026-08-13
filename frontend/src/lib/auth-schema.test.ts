import { describe, expect, it } from "vitest";

import { loginSchema } from "./auth-schema";

describe("loginSchema", () => {
  it("accepts a filled form", () => {
    expect(loginSchema.safeParse({ username: "admin", password: "secret" }).success).toBe(true);
  });

  it("rejects an empty username", () => {
    expect(loginSchema.safeParse({ username: "", password: "secret" }).success).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ username: "admin", password: "" }).success).toBe(false);
  });
});
