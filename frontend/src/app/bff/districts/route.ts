import { NextResponse } from "next/server";

import { bffForward } from "@/lib/bff-forward";
import { getSessionToken } from "@/lib/session";

export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { status, data } = await bffForward("POST", "/districts", token, body);
  return NextResponse.json(data ?? {}, { status });
}
