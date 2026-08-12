import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

// POST: set the play order from a full array of song IDs.
export async function POST(req: NextRequest) {
  if (!getAdminSession()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  await prisma.$transaction(
    ids.map((id: string, i: number) =>
      prisma.song.update({ where: { id }, data: { order: i } })
    )
  );

  return NextResponse.json({ ok: true });
}
