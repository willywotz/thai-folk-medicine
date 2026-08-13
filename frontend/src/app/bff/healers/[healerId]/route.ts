import { NextResponse } from "next/server";

import { bffForward } from "@/lib/bff-forward";
import { getSessionToken } from "@/lib/session";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ healerId: string }> },
) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const { healerId } = await params;
  const { status, data } = await bffForward("DELETE", `/healers/${healerId}`, token);
  if (status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(data ?? {}, { status });
}
