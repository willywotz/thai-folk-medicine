import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "./proxy";

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: cookie ? { cookie } : {},
  });
}

describe("proxy auth guard", () => {
  it("redirects /staff to /login without a session", () => {
    const res = proxy(request("/staff/healers"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("allows /staff through with a session", () => {
    const res = proxy(request("/staff", "session=token"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects /login to /staff when already logged in", () => {
    const res = proxy(request("/login", "session=token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/staff");
  });

  it("allows /login through without a session", () => {
    const res = proxy(request("/login"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
