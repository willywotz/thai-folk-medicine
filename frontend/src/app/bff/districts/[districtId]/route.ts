import { NextResponse } from "next/server";

import { bffForward } from "@/lib/bff-forward";
import { getSessionToken } from "@/lib/session";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ districtId: string }> },
) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const { districtId } = await params;
  const body = await request.json().catch(() => null);
  const { status, data } = await bffForward("PUT", `/districts/${districtId}`, token, body);
  return NextResponse.json(data ?? {}, { status });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ districtId: string }> },
) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const { districtId } = await params;
  const { status, data } = await bffForward("DELETE", `/districts/${districtId}`, token);
  if (status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(data ?? {}, { status });
}
