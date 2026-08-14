import { NextResponse } from "next/server";

import { bffForward } from "@/lib/bff-forward";
import { getSessionToken } from "@/lib/session";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ herbId: string }> },
) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const { herbId } = await params;
  const body = await request.json().catch(() => null);
  const { status, data } = await bffForward("PUT", `/herbs/${herbId}`, token, body);
  return NextResponse.json(data ?? {}, { status });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ herbId: string }> },
) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const { herbId } = await params;
  const { status, data } = await bffForward("DELETE", `/herbs/${herbId}`, token);
  if (status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(data ?? {}, { status });
}
