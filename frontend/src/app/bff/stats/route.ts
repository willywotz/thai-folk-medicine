import { NextResponse } from "next/server";

import { bffForward } from "@/lib/bff-forward";
import { getSessionToken } from "@/lib/session";

/** GET /bff/stats — the Go endpoint is JWT-guarded, so this forwards a Bearer token. */
export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const { status, data } = await bffForward("GET", "/stats", token);
  return NextResponse.json(data ?? {}, { status });
}
