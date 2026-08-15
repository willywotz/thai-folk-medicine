import { NextResponse } from "next/server";

import { bffForward } from "@/lib/bff-forward";
import { getSessionToken } from "@/lib/session";

/** GET /bff/activity — the Go endpoint is JWT-guarded, so this forwards the query string with a Bearer token. */
export async function GET(request: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const { search } = new URL(request.url);
  const { status, data } = await bffForward("GET", `/activity${search}`, token);
  return NextResponse.json(data ?? {}, { status });
}
