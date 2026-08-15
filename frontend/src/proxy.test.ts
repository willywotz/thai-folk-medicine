import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "./proxy";

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: cookie ? { cookie } : {},
  });
}

describe("proxy auth guard", () => {
  it("redirects /staff to /th/staff/healers without a session", () => {
    const res = proxy(request("/staff/healers"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/th/staff/healers",
    );
  });

  it("allows /staff through with a session", () => {
    const res = proxy(request("/staff", "session=token"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/th/staff");
  });

  it("redirects /login to /staff when already logged in", () => {
    const res = proxy(request("/login", "session=token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/th/login");
  });

  it("allows /login through without a session", () => {
    const res = proxy(request("/login"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/th/login");
  });
});

describe("proxy locale", () => {
  it("redirects a locale-less path to the default locale", () => {
    const res = proxy(request("/herbs"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/th/herbs");
  });
  it("redirects bare root to the default locale", () => {
    const res = proxy(request("/"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/th");
  });
  it("allows an already-localed public path", () => {
    const res = proxy(request("/en/herbs"));
    expect(res.headers.get("location")).toBeNull();
  });
  it("guards localed staff without a session", () => {
    const res = proxy(request("/th/staff/healers"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/th/login");
  });
  it("allows localed staff with a session", () => {
    const res = proxy(request("/en/staff", "session=token"));
    expect(res.headers.get("location")).toBeNull();
  });
  it("redirects localed /login to staff when logged in, preserving locale", () => {
    const res = proxy(request("/en/login", "session=token"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/en/staff");
  });
  it("passes through a locale-prefix trap that only starts with staff", () => {
    const res = proxy(request("/th/staffing"));
    expect(res.headers.get("location")).toBeNull();
  });
  it("redirects localed /staff to login without a session", () => {
    const res = proxy(request("/en/staff"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/en/login");
  });
});

describe("proxy matcher", () => {
  // Mirror Next's matcher semantics for a pattern like "/((?!_next|api|bff|.*\\..*).*)".
  const matches = (path: string) =>
    new RegExp(`^${config.matcher[0]}$`).test(path);

  it("does NOT run middleware on /api/* (so the rewrite reaches the Go API)", () => {
    expect(matches("/api/v1/photos/3")).toBe(false);
  });

  it("still runs on UI paths", () => {
    expect(matches("/herbs")).toBe(true);
    expect(matches("/th/staff")).toBe(true);
  });
});
