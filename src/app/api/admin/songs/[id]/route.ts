import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// DELETE: remove a song and its files.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!getAdminSession()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const song = await prisma.song.findUnique({ where: { id: params.id } });
  if (!song) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.song.delete({ where: { id: params.id } });

  // Best-effort Blob cleanup.
  const urls = [song.audioFile, song.posterFile].filter(Boolean) as string[];
  await del(urls).catch(() => {});

  return NextResponse.json({ ok: true });
}
