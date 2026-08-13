import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session";

const base = process.env.INTERNAL_API_URL ?? "http://localhost:8080";

/** POST /bff/photos — forward a multipart upload to Go with the Bearer token. */
export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const form = await request.formData();
  const res = await fetch(`${base}/api/v1/photos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }, // no Content-Type: fetch sets the multipart boundary
    body: form,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return NextResponse.json(data ?? {}, { status: res.status });
}
