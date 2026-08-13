import { NextResponse } from "next/server";

import { clearSession, setSession } from "@/lib/session";

const base = process.env.INTERNAL_API_URL ?? "http://localhost:8080";

/** POST /bff/session — log in: exchange credentials for a token, store it httpOnly. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.username !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "username and password are required" }, { status: 400 });
  }

  const res = await fetch(`${base}/api/v1/authentication/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: body.username, password: body.password }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    return NextResponse.json({ error: "no token returned" }, { status: 502 });
  }
  await setSession(data.token);
  return NextResponse.json({ ok: true });
}

/** DELETE /bff/session — log out. */
export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
